import { cookies } from "next/headers";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  type AuthErrorResponse,
  type AuthUser,
  type LoginRequest,
  type LoginSuccessResponse,
  type MeSuccessResponse
} from "@hotel/shared";

const SESSION_COOKIE_NAME = "pms_session_token";
const DEFAULT_BACKEND_URL = "http://localhost:3334";

export type LoginResult = LoginSuccessResponse;

function getBackendUrl(): string {
  return process.env.BACKEND_SERVICE_URL || DEFAULT_BACKEND_URL;
}

export async function loginWithCredentials(email: string, password: string): Promise<LoginResult> {
  const loginBody: LoginRequest = { email, password };

  const response = await fetch(`${getBackendUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify(loginBody)
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<LoginResult> & Partial<AuthErrorResponse>;

  if (!response.ok || !payload.token || !payload.user || typeof payload.expiresIn !== "number") {
    const errorCode = payload.code || AUTH_ERROR_CODE.UNKNOWN;
    throw new Error(payload.message || AUTH_ERROR_MESSAGE[errorCode]);
  }

  return {
    token: payload.token,
    expiresIn: payload.expiresIn,
    user: payload.user
  };
}

export async function getUserFromSession(): Promise<AuthUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const response = await fetch(`${getBackendUrl()}/auth/me`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as MeSuccessResponse;
  return payload.user || null;
}

export function saveSessionCookie(token: string, expiresInSeconds: number): void {
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: expiresInSeconds
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE_NAME);
}
