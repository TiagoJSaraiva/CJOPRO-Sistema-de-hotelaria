import { cookies } from "next/headers";
import type {
  AdminErrorResponse,
  AdminHotel,
  AdminHotelCreateInput,
  AdminHotelUpdateInput,
  AdminItemResponse,
  AdminListResponse,
  AdminPermission,
  AdminRole,
  AdminUser
} from "@hotel/shared";

const SESSION_COOKIE_NAME = "pms_session_token";
const DEFAULT_BACKEND_URL = "http://localhost:3334";

function getBackendUrl(): string {
  return process.env.BACKEND_SERVICE_URL || DEFAULT_BACKEND_URL;
}

function getSessionToken(): string | null {
  return cookies().get(SESSION_COOKIE_NAME)?.value ?? null;
}

async function getAdminList<T>(path: string): Promise<T[]> {
  const token = getSessionToken();

  if (!token) {
    return [];
  }

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as AdminListResponse<T>;
  return payload.items || [];
}

async function requestAdmin<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown
): Promise<T | null> {
  const token = getSessionToken();

  if (!token) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as AdminErrorResponse;
    throw new Error(payload.message || "Falha na operacao administrativa.");
  }

  if (method === "DELETE") {
    return null;
  }

  const payload = (await response.json()) as AdminItemResponse<T>;
  return payload.item;
}

export type {
  AdminErrorResponse,
  AdminHotel,
  AdminHotelCreateInput,
  AdminHotelUpdateInput,
  AdminPermission,
  AdminRole,
  AdminUser
} from "@hotel/shared";

export function listHotels(): Promise<AdminHotel[]> {
  return getAdminList<AdminHotel>("/admin/hotels");
}

export function createHotel(payload: AdminHotelCreateInput): Promise<AdminHotel | null> {
  return requestAdmin<AdminHotel>("/admin/hotels", "POST", payload);
}

export function updateHotel(id: string, payload: AdminHotelUpdateInput): Promise<AdminHotel | null> {
  return requestAdmin<AdminHotel>(`/admin/hotels/${id}`, "PUT", payload);
}

export function deleteHotel(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/hotels/${id}`, "DELETE");
}

export function listUsers(): Promise<AdminUser[]> {
  return getAdminList<AdminUser>("/admin/users");
}

export function listRoles(): Promise<AdminRole[]> {
  return getAdminList<AdminRole>("/admin/roles");
}

export function listPermissions(): Promise<AdminPermission[]> {
  return getAdminList<AdminPermission>("/admin/permissions");
}
