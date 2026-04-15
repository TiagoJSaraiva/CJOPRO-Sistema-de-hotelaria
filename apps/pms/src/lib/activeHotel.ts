import { cookies } from "next/headers";
import {
  ACTIVE_HOTEL_GLOBAL_VALUE,
  type AuthUser
} from "@hotel/shared";

const ACTIVE_HOTEL_COOKIE_NAME = "pms_active_hotel";
const ACTIVE_HOTEL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

type ActiveHotelOption = {
  hotelId: string | null;
  label: string;
};

function normalizeHotelName(value: string | null): string {
  const trimmed = String(value || "").trim();
  return trimmed || "Hotel sem nome";
}

function dedupeHotelsById(user: Pick<AuthUser, "roleAssignments">): Array<{ id: string; name: string }> {
  const uniqueById = new Map<string, string>();

  for (const assignment of user.roleAssignments || []) {
    const hotelId = String(assignment.hotelId || "").trim();

    if (!hotelId) {
      continue;
    }

    if (!uniqueById.has(hotelId)) {
      uniqueById.set(hotelId, normalizeHotelName(assignment.hotelName));
    }
  }

  return Array.from(uniqueById.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

export function canAccessGlobalScope(user: Pick<AuthUser, "roleAssignments">): boolean {
  return (user.roleAssignments || []).some((assignment) => !assignment.hotelId);
}

export function listAccessibleHotels(user: Pick<AuthUser, "roleAssignments">): Array<{ id: string; name: string }> {
  return dedupeHotelsById(user);
}

export function listActiveHotelOptions(user: Pick<AuthUser, "roleAssignments">): ActiveHotelOption[] {
  const options: ActiveHotelOption[] = [];

  if (canAccessGlobalScope(user)) {
    options.push({ hotelId: null, label: "Sistema (todos os hoteis)" });
  }

  for (const hotel of listAccessibleHotels(user)) {
    options.push({ hotelId: hotel.id, label: hotel.name });
  }

  return options;
}

export function decodeActiveHotelCookie(rawValue: string | null | undefined): string | null | undefined {
  const normalized = String(rawValue || "").trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized === ACTIVE_HOTEL_GLOBAL_VALUE) {
    return null;
  }

  return normalized;
}

export function encodeActiveHotelCookie(hotelId: string | null): string {
  return hotelId ? hotelId : ACTIVE_HOTEL_GLOBAL_VALUE;
}

export function getActiveHotelCookieValue(): string | null | undefined {
  const value = cookies().get(ACTIVE_HOTEL_COOKIE_NAME)?.value;
  return decodeActiveHotelCookie(value);
}

export function userCanAccessHotel(user: Pick<AuthUser, "roleAssignments">, hotelId: string | null): boolean {
  if (hotelId === null) {
    return canAccessGlobalScope(user);
  }

  if (!hotelId) {
    return false;
  }

  return listAccessibleHotels(user).some((hotel) => hotel.id === hotelId);
}

export function resolveActiveHotelForUser(
  user: Pick<AuthUser, "roleAssignments">,
  preferredHotelId: string | null | undefined
): string | null {
  const normalizedPreferred = preferredHotelId === undefined ? undefined : preferredHotelId;

  if (normalizedPreferred !== undefined && userCanAccessHotel(user, normalizedPreferred)) {
    return normalizedPreferred;
  }

  if (canAccessGlobalScope(user)) {
    return null;
  }

  const accessibleHotels = listAccessibleHotels(user);

  if (!accessibleHotels.length) {
    return null;
  }

  return accessibleHotels[0].id;
}

export function saveActiveHotelCookie(hotelId: string | null): void {
  cookies().set(ACTIVE_HOTEL_COOKIE_NAME, encodeActiveHotelCookie(hotelId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACTIVE_HOTEL_COOKIE_MAX_AGE_SECONDS
  });
}

export function clearActiveHotelCookie(): void {
  cookies().delete(ACTIVE_HOTEL_COOKIE_NAME);
}

export { ACTIVE_HOTEL_COOKIE_NAME };
export type { ActiveHotelOption };
