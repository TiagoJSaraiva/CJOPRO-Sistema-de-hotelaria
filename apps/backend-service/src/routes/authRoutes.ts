import type { FastifyInstance } from "fastify";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  normalizeEmail,
  type AuthErrorResponse,
  type LoginRequest,
  type LoginSuccessResponse,
  type MeSuccessResponse,
  type SessionPayload
} from "@hotel/shared";
import { mapAuthUserFromDb } from "../admin/mappers";
import { resolveActiveHotelContext } from "../auth/activeHotel";
import { normalizeOptionalText } from "../common/text";
import { getAuthError, getSessionFromRequest, matchesPasswordHash, SESSION_TTL_SECONDS, signToken } from "../auth/session";
import { createAuthRepository, type AuthRepository } from "../repositories/authRepository";

type LoginBody = Partial<LoginRequest>;
const MAX_FAILED_ATTEMPTS = 10;
const LOGIN_LOCK_DURATION_MS = 2 * 60 * 1000;

function invalidCredentialsError(): AuthErrorResponse {
  return {
    code: AUTH_ERROR_CODE.INVALID_CREDENTIALS,
    message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.INVALID_CREDENTIALS]
  };
}

function accountLockedError(retryAfterSeconds: number): AuthErrorResponse {
  return {
    code: AUTH_ERROR_CODE.ACCOUNT_LOCKED,
    message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.ACCOUNT_LOCKED],
    retryAfterSeconds
  };
}

function getScopedAuthUser(payload: SessionPayload, activeHotelId: string | null): MeSuccessResponse["user"] {
  const assignments = payload.roleAssignments || [];
  const hasPerAssignmentPermissions = assignments.some((assignment) => Array.isArray(assignment.permissions));

  if (!hasPerAssignmentPermissions) {
    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      tenantId: payload.tenantId,
      roles: payload.roles,
      permissions: payload.permissions,
      roleAssignments: payload.roleAssignments
    };
  }

  const scopedAssignments = assignments.filter((assignment) => {
    if (activeHotelId === null) {
      return assignment.hotelId === null;
    }

    return assignment.hotelId === activeHotelId;
  });

  const roles = Array.from(new Set(scopedAssignments.map((assignment) => assignment.roleName).filter(Boolean)));
  const permissions = Array.from(
    new Set(
      scopedAssignments.flatMap((assignment) => assignment.permissions || []).map((permission) => String(permission || "").trim()).filter(Boolean)
    )
  );

  return {
    id: payload.id,
    name: payload.name,
    email: payload.email,
    tenantId: payload.tenantId,
    roles,
    permissions,
    roleAssignments: payload.roleAssignments
  };
}

export function registerAuthRoutes(app: FastifyInstance, repository: AuthRepository = createAuthRepository()): void {
  app.post<{ Body: LoginBody }>("/auth/login", async (request, reply) => {
    const email = normalizeOptionalText(normalizeEmail(request.body?.email || ""));
    const password = request.body?.password;

    if (!email || !password) {
      const error: AuthErrorResponse = {
        code: AUTH_ERROR_CODE.MISSING_FIELDS,
        message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.MISSING_FIELDS]
      };
      return reply.status(400).send(error);
    }

    const userRow = await repository.findUserByEmail(email).catch((error) => {
      request.log.error(error);
      return undefined;
    });

    if (userRow === undefined) {
      return reply.status(500).send({ message: "Falha ao autenticar usuario." });
    }

    if (!userRow) {
      return reply.status(401).send(invalidCredentialsError());
    }

    if (!userRow.is_active) {
      return reply.status(401).send(invalidCredentialsError());
    }

    const now = new Date();
    const lockedUntil = userRow.locked_until ? new Date(userRow.locked_until) : null;

    if (lockedUntil && !Number.isNaN(lockedUntil.getTime())) {
      if (lockedUntil.getTime() > now.getTime()) {
        const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
        reply.header("Retry-After", String(retryAfterSeconds));
        return reply.status(429).send(accountLockedError(retryAfterSeconds));
      }

      const clearLockResult = await repository.clearExpiredLoginLock(userRow.id).catch((error) => {
        request.log.error(error);
        return false;
      });

      if (clearLockResult === false) {
        return reply.status(500).send({ message: "Falha ao autenticar usuario." });
      }

      userRow.failed_attempts = 0;
      userRow.locked_until = null;
    }

    const passwordMatches = await matchesPasswordHash(password, userRow.password_hash);

    if (!passwordMatches) {
      const nextFailedAttempts = (userRow.failed_attempts ?? 0) + 1;
      const shouldLock = nextFailedAttempts >= MAX_FAILED_ATTEMPTS;
      const lockUntil = shouldLock ? new Date(now.getTime() + LOGIN_LOCK_DURATION_MS) : null;

      const markFailedResult = await repository
        .markFailedLoginAttempt(userRow.id, nextFailedAttempts, lockUntil ? lockUntil.toISOString() : null)
        .catch((error) => {
          request.log.error(error);
          return false;
        });

      if (markFailedResult === false) {
        return reply.status(500).send({ message: "Falha ao autenticar usuario." });
      }

      if (shouldLock && lockUntil) {
        const retryAfterSeconds = Math.max(1, Math.ceil((lockUntil.getTime() - now.getTime()) / 1000));
        reply.header("Retry-After", String(retryAfterSeconds));
        return reply.status(429).send(accountLockedError(retryAfterSeconds));
      }

      return reply.status(401).send(invalidCredentialsError());
    }

    const authUser = mapAuthUserFromDb(userRow);

    await repository.markSuccessfulLogin(authUser.id).catch((error) => {
      request.log.error(error);
    });

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      tenantId: authUser.tenantId,
      roles: authUser.roles,
      permissions: authUser.permissions,
      roleAssignments: authUser.roleAssignments,
      iat: nowInSeconds,
      exp: nowInSeconds + SESSION_TTL_SECONDS
    };

    const token = signToken(payload);

    const response: LoginSuccessResponse = {
      token,
      expiresIn: SESSION_TTL_SECONDS,
      user: {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        tenantId: payload.tenantId,
        roles: payload.roles,
        permissions: payload.permissions,
        roleAssignments: payload.roleAssignments
      }
    };

    return reply.send(response);
  });

  app.get("/auth/me", async (request, reply) => {
    const payload = getSessionFromRequest(request);

    if (!payload) {
      return reply.status(401).send(getAuthError(AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED));
    }

    const contextResult = resolveActiveHotelContext(payload, request.headers);

    if (!contextResult.ok) {
      return reply.status(contextResult.statusCode).send({ message: contextResult.message });
    }

    const scopedUser = getScopedAuthUser(payload, contextResult.activeHotelId);

    const response: MeSuccessResponse = {
      user: scopedUser
    };

    return reply.send(response);
  });
}
