import { createHmac, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import { AUTH_ERROR_MESSAGE, type AuthErrorResponse, type SessionPayload } from "@hotel/shared";

export type { SessionPayload };

export const MIN_SESSION_SECRET_LENGTH = 32;
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export function getRequiredSessionSecret(): string {
  const sessionSecret = process.env.AUTH_SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error("Missing required environment variable: AUTH_SESSION_SECRET");
  }

  if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(`AUTH_SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters long.`);
  }

  return sessionSecret;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signToken(payload: SessionPayload): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", getRequiredSessionSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", getRequiredSessionSecret()).update(encodedPayload).digest("base64url");

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

export function getAuthError(code: AuthErrorResponse["code"]): AuthErrorResponse {
  return {
    code,
    message: AUTH_ERROR_MESSAGE[code]
  };
}

export function getSessionFromRequest(request: { headers: { authorization?: string } }): SessionPayload | null {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export async function hashTemporaryPassword(value: string): Promise<string> {
  return argon2.hash(value, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
  });
}

export async function matchesPasswordHash(
  plainTextPassword: string,
  storedPasswordHash: string | null | undefined
): Promise<boolean> {
  if (!storedPasswordHash) {
    return false;
  }

  if (!storedPasswordHash.startsWith("$argon2id$")) {
    return false;
  }

  try {
    return await argon2.verify(storedPasswordHash, plainTextPassword);
  } catch {
    return false;
  }
}
