import Fastify from "fastify";
import cors from "@fastify/cors";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  type AuthErrorResponse,
  type AuthUser,
  type LoginRequest,
  type LoginSuccessResponse,
  type MeSuccessResponse
} from "@hotel/shared";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT || 3334);

type SessionUser = AuthUser;

type SessionPayload = SessionUser & {
  iat: number;
  exp: number;
};

type LoginBody = Partial<LoginRequest>;

const SESSION_SECRET = process.env.AUTH_SESSION_SECRET || "dev-auth-session-secret-change-me";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

const DEV_USER = {
  id: process.env.AUTH_USER_ID || randomUUID(),
  name: process.env.AUTH_USER_NAME || "Administrador",
  email: process.env.AUTH_USER_EMAIL || "admin@hotel.local",
  password: process.env.AUTH_USER_PASSWORD || "123456",
  tenantId: process.env.AUTH_USER_TENANT_ID || null,
  roles: (process.env.AUTH_USER_ROLES || "hotel_owner")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  permissions: (process.env.AUTH_USER_PERMISSIONS || "checkin_manage,checkout_manage,reservas_old_view,reservas_delete")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signToken(payload: SessionPayload): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest("base64url");

  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (!parsed.exp || parsed.exp <= nowInSeconds) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function bootstrap() {
  await app.register(cors, { origin: true });

  app.get("/health", async () => ({
    status: "ok",
    service: "backend-service"
  }));

  app.post<{ Body: LoginBody }>("/auth/login", async (request, reply) => {
    const email = request.body?.email?.trim().toLowerCase();
    const password = request.body?.password;

    if (!email || !password) {
      const error: AuthErrorResponse = {
        code: AUTH_ERROR_CODE.MISSING_FIELDS,
        message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.MISSING_FIELDS]
      };
      return reply.status(400).send(error);
    }

    if (email !== DEV_USER.email || password !== DEV_USER.password) {
      const error: AuthErrorResponse = {
        code: AUTH_ERROR_CODE.INVALID_CREDENTIALS,
        message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.INVALID_CREDENTIALS]
      };
      return reply.status(401).send(error);
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      id: DEV_USER.id,
      name: DEV_USER.name,
      email: DEV_USER.email,
      tenantId: DEV_USER.tenantId,
      roles: DEV_USER.roles,
      permissions: DEV_USER.permissions,
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
        permissions: payload.permissions
      }
    };

    return reply.send(response);
  });

  app.get("/auth/me", async (request, reply) => {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;

    if (!token) {
      const error: AuthErrorResponse = {
        code: AUTH_ERROR_CODE.TOKEN_MISSING,
        message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.TOKEN_MISSING]
      };
      return reply.status(401).send(error);
    }

    const payload = verifyToken(token);

    if (!payload) {
      const error: AuthErrorResponse = {
        code: AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED,
        message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED]
      };
      return reply.status(401).send(error);
    }

    const response: MeSuccessResponse = {
      user: {
        id: payload.id,
        name: payload.name,
        email: payload.email,
        tenantId: payload.tenantId,
        roles: payload.roles,
        permissions: payload.permissions
      }
    };

    return reply.send(response);
  });

  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Backend service rodando em http://localhost:${port}`);
}

bootstrap().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
