import type { FastifyInstance } from "fastify";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  createServerClient,
  normalizeEmail,
  type AuthErrorResponse,
  type LoginRequest,
  type LoginSuccessResponse,
  type MeSuccessResponse,
  type SessionPayload
} from "@hotel/shared";
import { mapAuthUserFromDb } from "../admin/mappers";
import { normalizeOptionalText } from "../common/text";
import { getAuthError, getSessionFromRequest, matchesPasswordHash, SESSION_TTL_SECONDS, signToken } from "../auth/session";

type LoginBody = Partial<LoginRequest>;

export function registerAuthRoutes(app: FastifyInstance): void {
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

    const supabase = createServerClient();
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id,name,email,is_active,password_hash,user_roles(hotel_id,roles(id,name,hotel_id,hotels(name),role_permissions(permissions(name))))")
      .eq("email", email)
      .single();

    if (userError) {
      if (userError.code !== "PGRST116") {
        request.log.error(userError);
        return reply.status(500).send({ message: "Falha ao autenticar usuario." });
      }

      const error: AuthErrorResponse = {
        code: AUTH_ERROR_CODE.INVALID_CREDENTIALS,
        message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.INVALID_CREDENTIALS]
      };

      return reply.status(401).send(error);
    }

    if (!userRow?.is_active || !matchesPasswordHash(password, userRow.password_hash)) {
      const error: AuthErrorResponse = {
        code: AUTH_ERROR_CODE.INVALID_CREDENTIALS,
        message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.INVALID_CREDENTIALS]
      };
      return reply.status(401).send(error);
    }

    const authUser = mapAuthUserFromDb(userRow);

    const { error: lastLoginError } = await supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString(), failed_attempts: 0 })
      .eq("id", authUser.id);

    if (lastLoginError) {
      request.log.error(lastLoginError);
    }

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

    const response: MeSuccessResponse = {
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
}
