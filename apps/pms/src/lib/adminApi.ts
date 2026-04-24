import { cookies } from "next/headers";
import {
  ACTIVE_HOTEL_GLOBAL_VALUE,
  ACTIVE_HOTEL_HEADER_NAME,
  AdminErrorResponse,
  AdminHotel,
  AdminHotelCreateInput,
  AdminHotelUpdateInput,
  AdminItemResponse,
  AdminListResponse,
  AdminPermission,
  AdminPermissionCreateInput,
  AdminPermissionUpdateInput,
  AdminProduct,
  AdminProductCreateInput,
  AdminProductUpdateInput,
  AdminReservation,
  AdminReservationCreateInput,
  AdminReservationUpdateInput,
  AdminRoom,
  AdminRoomCreateInput,
  AdminRoomUpdateInput,
  AdminRolesReferenceData,
  AdminRole,
  AdminRoleCreateInput,
  AdminRoleUpdateInput,
  AdminSeason,
  AdminSeasonCreateInput,
  AdminSeasonRoomRate,
  AdminSeasonRoomRateCreateInput,
  AdminSeasonRoomRateUpdateInput,
  AdminSeasonUpdateInput,
  AdminCustomer,
  AdminCustomerCreateInput,
  AdminCustomerUpdateInput,
  AdminUser,
  AdminUserCreateInput,
  AdminUserUpdateInput,
  AdminUsersReferenceData
} from "@hotel/shared";
import {
  getActiveHotelCookieValue
} from "./activeHotel";

const SESSION_COOKIE_NAME = "pms_session_token";
const DEFAULT_BACKEND_URL = "http://localhost:3334";

function getBackendUrl(): string {
  return process.env.BACKEND_SERVICE_URL || DEFAULT_BACKEND_URL;
}

function getSessionToken(): string | null {
  return cookies().get(SESSION_COOKIE_NAME)?.value ?? null;
}

function getActiveHotelHeaderValue(): string | null {
  const preferredHotelId = getActiveHotelCookieValue();

  if (preferredHotelId === undefined) {
    return null;
  }

  return preferredHotelId || ACTIVE_HOTEL_GLOBAL_VALUE;
}

async function getAdminList<T>(path: string): Promise<T[]> {
  const token = getSessionToken();

  if (!token) {
    return [];
  }

  const activeHotelHeaderValue = getActiveHotelHeaderValue();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`
  };

  if (activeHotelHeaderValue !== null) {
    headers[ACTIVE_HOTEL_HEADER_NAME] = activeHotelHeaderValue;
  }

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: "GET",
    cache: "no-store",
    headers
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
  const activeHotelHeaderValue = getActiveHotelHeaderValue();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`
  };

  if (activeHotelHeaderValue !== null) {
    headers[ACTIVE_HOTEL_HEADER_NAME] = activeHotelHeaderValue;
  }

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

  const activeHotelHeaderValue = getActiveHotelHeaderValue();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`
  };

  if (activeHotelHeaderValue !== null) {
    headers[ACTIVE_HOTEL_HEADER_NAME] = activeHotelHeaderValue;
  }

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: "GET",
    cache: "no-store",
    headers
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
  AdminCustomer,
  AdminCustomerCreateInput,
  AdminCustomerUpdateInput,
  AdminErrorResponse,
  AdminHotel,
  AdminHotelCreateInput,
  AdminHotelUpdateInput,
  AdminPermission,
  AdminPermissionCreateInput,
  AdminPermissionUpdateInput,
  AdminProduct,
  AdminProductCreateInput,
  AdminProductUpdateInput,
  AdminReservation,
  AdminReservationCreateInput,
  AdminReservationUpdateInput,
  AdminRoom,
  AdminRoomCreateInput,
  AdminRoomUpdateInput,
  AdminRolesReferenceData,
  AdminRole,
  AdminRoleCreateInput,
  AdminRoleUpdateInput,
  AdminSeason,
  AdminSeasonCreateInput,
  AdminSeasonRoomRate,
  AdminSeasonRoomRateCreateInput,
  AdminSeasonRoomRateUpdateInput,
  AdminSeasonUpdateInput,
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

export function listRooms(): Promise<AdminRoom[]> {
  return getAdminList<AdminRoom>("/admin/rooms");
}

export function createRoom(payload: AdminRoomCreateInput): Promise<AdminRoom | null> {
  return requestAdmin<AdminRoom>("/admin/rooms", "POST", payload);
}

export function updateRoom(id: string, payload: AdminRoomUpdateInput): Promise<AdminRoom | null> {
  return requestAdmin<AdminRoom>(`/admin/rooms/${id}`, "PUT", payload);
}

export function deleteRoom(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/rooms/${id}`, "DELETE");
}

export function listCustomers(): Promise<AdminCustomer[]> {
  return getAdminList<AdminCustomer>("/admin/customers");
}

export function createCustomer(payload: AdminCustomerCreateInput): Promise<AdminCustomer | null> {
  return requestAdmin<AdminCustomer>("/admin/customers", "POST", payload);
}

export function updateCustomer(id: string, payload: AdminCustomerUpdateInput): Promise<AdminCustomer | null> {
  return requestAdmin<AdminCustomer>(`/admin/customers/${id}`, "PUT", payload);
}

export function deleteCustomer(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/customers/${id}`, "DELETE");
}

export function listReservations(): Promise<AdminReservation[]> {
  return getAdminList<AdminReservation>("/admin/reservations");
}

export function createReservation(payload: AdminReservationCreateInput): Promise<AdminReservation | null> {
  return requestAdmin<AdminReservation>("/admin/reservations", "POST", payload);
}

export function updateReservation(id: string, payload: AdminReservationUpdateInput): Promise<AdminReservation | null> {
  return requestAdmin<AdminReservation>(`/admin/reservations/${id}`, "PUT", payload);
}

export function deleteReservation(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/reservations/${id}`, "DELETE");
}

export function listProducts(): Promise<AdminProduct[]> {
  return getAdminList<AdminProduct>("/admin/products");
}

export function createProduct(payload: AdminProductCreateInput): Promise<AdminProduct | null> {
  return requestAdmin<AdminProduct>("/admin/products", "POST", payload);
}

export function updateProduct(id: string, payload: AdminProductUpdateInput): Promise<AdminProduct | null> {
  return requestAdmin<AdminProduct>(`/admin/products/${id}`, "PUT", payload);
}

export function deleteProduct(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/products/${id}`, "DELETE");
}

export function listSeasons(): Promise<AdminSeason[]> {
  return getAdminList<AdminSeason>("/admin/seasons");
}

export function createSeason(payload: AdminSeasonCreateInput): Promise<AdminSeason | null> {
  return requestAdmin<AdminSeason>("/admin/seasons", "POST", payload);
}

export function updateSeason(id: string, payload: AdminSeasonUpdateInput): Promise<AdminSeason | null> {
  return requestAdmin<AdminSeason>(`/admin/seasons/${id}`, "PUT", payload);
}

export function deleteSeason(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/seasons/${id}`, "DELETE");
}

export function listSeasonRoomRates(): Promise<AdminSeasonRoomRate[]> {
  return getAdminList<AdminSeasonRoomRate>("/admin/season-room-rates");
}

export function createSeasonRoomRate(payload: AdminSeasonRoomRateCreateInput): Promise<AdminSeasonRoomRate | null> {
  return requestAdmin<AdminSeasonRoomRate>("/admin/season-room-rates", "POST", payload);
}

export function updateSeasonRoomRate(id: string, payload: AdminSeasonRoomRateUpdateInput): Promise<AdminSeasonRoomRate | null> {
  return requestAdmin<AdminSeasonRoomRate>(`/admin/season-room-rates/${id}`, "PUT", payload);
}

export function deleteSeasonRoomRate(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/season-room-rates/${id}`, "DELETE");
}
