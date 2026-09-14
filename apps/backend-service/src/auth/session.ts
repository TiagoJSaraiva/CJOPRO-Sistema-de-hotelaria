import { createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import argon2 from "argon2";
import {
  AUTH_ERROR_MESSAGE,
  type AuthErrorResponse,
  type SessionPayload,
} from "@hotel/shared";

export type { SessionPayload };

export const MIN_SESSION_SECRET_LENGTH = 32;
export const SESSION_TTL_SECONDS = 60 * 60 * 8;
const MAX_SESSION_PAYLOAD_BYTES = 64 * 1024;

export function getRequiredSessionSecret(): string {
  const sessionSecret = process.env.AUTH_SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error(
      "Missing required environment variable: AUTH_SESSION_SECRET",
    );
  }

  if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters long.`,
    );
  }

  return sessionSecret;
}

export function signToken(payload: SessionPayload): string {
  const json = Buffer.from(JSON.stringify(payload));
  if (json.length > MAX_SESSION_PAYLOAD_BYTES) {
    throw new Error("Session payload exceeds the supported size.");
  }
  const encodedPayload = `v2.${deflateRawSync(json).toString("base64url")}`;
  const signature = createHmac("sha256", getRequiredSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  const compressed = parts.length === 3 && parts[0] === "v2";
  if (!compressed && parts.length !== 2) return null;
  const encodedPayload = compressed ? parts[1] : parts[0];
  const signature = parts[compressed ? 2 : 1];

  if (
    !encodedPayload ||
    !signature ||
    !/^[A-Za-z0-9_-]+$/.test(encodedPayload)
  ) {
    return null;
  }

  const expectedSignature = createHmac("sha256", getRequiredSessionSecret())
    .update(compressed ? `v2.${encodedPayload}` : encodedPayload)
    .digest("base64url");

  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    // Authenticate the compressed bytes before allocating the expanded payload.
    const bytes = Buffer.from(encodedPayload, "base64url");
    const json = compressed
      ? inflateRawSync(bytes, { maxOutputLength: MAX_SESSION_PAYLOAD_BYTES })
      : bytes;
    if (json.length > MAX_SESSION_PAYLOAD_BYTES) return null;
    const parsed: unknown = JSON.parse(json.toString("utf8"));
    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (!isSessionPayload(parsed) || parsed.exp <= nowInSeconds) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isSessionPayload(value: unknown): value is SessionPayload {
  const isRecord = (item: unknown): item is Record<string, unknown> =>
    typeof item === "object" && item !== null && !Array.isArray(item);
  const isStrings = (item: unknown): item is string[] =>
    Array.isArray(item) && item.every((entry) => typeof entry === "string");
  const isNullableString = (item: unknown) =>
    item === null || typeof item === "string";
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    isNullableString(value.tenantId) &&
    isStrings(value.roles) &&
    isStrings(value.permissions) &&
    typeof value.iat === "number" &&
    Number.isFinite(value.iat) &&
    typeof value.exp === "number" &&
    Number.isFinite(value.exp) &&
    Array.isArray(value.roleAssignments) &&
    value.roleAssignments.every(
      (role) =>
        isRecord(role) &&
        typeof role.roleId === "string" &&
        typeof role.roleName === "string" &&
        (role.roleType === "SYSTEM_ROLE" || role.roleType === "HOTEL_ROLE") &&
        isNullableString(role.hotelId) &&
        isNullableString(role.hotelName) &&
        (role.permissions === undefined || isStrings(role.permissions)),
    )
  );
}

export function getAuthError(
  code: AuthErrorResponse["code"],
): AuthErrorResponse {
  return {
    code,
    message: AUTH_ERROR_MESSAGE[code],
  };
}

export function getSessionFromRequest(request: {
  headers: { authorization?: string };
}): SessionPayload | null {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

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
    parallelism: 1,
  });
}

export async function matchesPasswordHash(
  plainTextPassword: string,
  storedPasswordHash: string | null | undefined,
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
