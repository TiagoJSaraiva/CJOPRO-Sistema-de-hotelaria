import { cookies } from "next/headers";
import type {
  AdminErrorResponse,
  AdminHotel,
  AdminHotelCreateInput,
  AdminHotelUpdateInput,
  AdminItemResponse,
  AdminListResponse,
  AdminPermission,
  AdminPermissionCreateInput,
  AdminPermissionUpdateInput,
  AdminRolesReferenceData,
  AdminRole,
  AdminRoleCreateInput,
  AdminRoleUpdateInput,
  AdminUser
  ,AdminUserCreateInput
  ,AdminUserUpdateInput
  ,AdminUsersReferenceData
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

  const hasBody = body !== undefined;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`
  };

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method,
    cache: "no-store",
    headers,
    body: hasBody ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as AdminErrorResponse;
    const error = new Error(payload.message || "Falha na operacao administrativa.") as Error & { statusCode?: number };
    error.statusCode = response.status;
    throw error;
  }

  if (method === "DELETE") {
    return null;
  }

  const payload = (await response.json()) as AdminItemResponse<T>;
  return payload.item;
}

async function getAdminData<T>(path: string): Promise<T> {
  const token = getSessionToken();

  if (!token) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as AdminErrorResponse;
    const error = new Error(payload.message || "Falha na consulta administrativa.") as Error & { statusCode?: number };
    error.statusCode = response.status;
    throw error;
  }

  return (await response.json()) as T;
}

export type {
  AdminErrorResponse,
  AdminHotel,
  AdminHotelCreateInput,
  AdminHotelUpdateInput,
  AdminPermission,
  AdminPermissionCreateInput,
  AdminPermissionUpdateInput,
  AdminRolesReferenceData,
  AdminRole,
  AdminRoleCreateInput,
  AdminRoleUpdateInput,
  AdminUser,
  AdminUserCreateInput,
  AdminUserUpdateInput,
  AdminUsersReferenceData
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

export function getUsersReferenceData(): Promise<AdminUsersReferenceData> {
  return getAdminData<AdminUsersReferenceData>("/admin/users/reference-data");
}

export function createUser(payload: AdminUserCreateInput): Promise<AdminUser | null> {
  return requestAdmin<AdminUser>("/admin/users", "POST", payload);
}

export function updateUser(id: string, payload: AdminUserUpdateInput): Promise<AdminUser | null> {
  return requestAdmin<AdminUser>(`/admin/users/${id}`, "PUT", payload);
}

export function deleteUser(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/users/${id}`, "DELETE");
}

export function listRoles(): Promise<AdminRole[]> {
  return getAdminList<AdminRole>("/admin/roles");
}

export function getRolesReferenceData(): Promise<AdminRolesReferenceData> {
  return getAdminData<AdminRolesReferenceData>("/admin/roles/reference-data");
}

export function createRole(payload: AdminRoleCreateInput): Promise<AdminRole | null> {
  return requestAdmin<AdminRole>("/admin/roles", "POST", payload);
}

export function updateRole(id: string, payload: AdminRoleUpdateInput): Promise<AdminRole | null> {
  return requestAdmin<AdminRole>(`/admin/roles/${id}`, "PUT", payload);
}

export function deleteRole(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/roles/${id}`, "DELETE");
}

export function listPermissions(): Promise<AdminPermission[]> {
  return getAdminList<AdminPermission>("/admin/permissions");
}

export function createPermission(payload: AdminPermissionCreateInput): Promise<AdminPermission | null> {
  return requestAdmin<AdminPermission>("/admin/permissions", "POST", payload);
}

export function updatePermission(id: string, payload: AdminPermissionUpdateInput): Promise<AdminPermission | null> {
  return requestAdmin<AdminPermission>(`/admin/permissions/${id}`, "PUT", payload);
}

export function deletePermission(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/permissions/${id}`, "DELETE");
}
