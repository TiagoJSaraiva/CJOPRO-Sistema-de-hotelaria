import { ACTIVE_HOTEL_GLOBAL_VALUE, ACTIVE_HOTEL_HEADER_NAME, type SessionPayload } from "@hotel/shared";

type HeaderValue = string | string[] | undefined;

export type ActiveHotelValidationResult =
  | { ok: true; activeHotelId: string | null }
  | { ok: false; statusCode: number; message: string };

function getFirstHeaderValue(value: HeaderValue): string | null {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim().length > 0);
    return first ? first.trim() : null;
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return null;
}

function listAccessibleHotelIds(session: Pick<SessionPayload, "roleAssignments">): string[] {
  const ids = new Set<string>();

  for (const assignment of session.roleAssignments || []) {
    const hotelId = String(assignment.hotelId || "").trim();

    if (hotelId) {
      ids.add(hotelId);
    }
  }

  return Array.from(ids).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

function canAccessGlobalScope(session: Pick<SessionPayload, "roleAssignments">): boolean {
  return (session.roleAssignments || []).some((assignment) => !assignment.hotelId);
}

function parseRequestedActiveHotelId(headers: Record<string, HeaderValue>): string | null | undefined {
  const rawHeaderValue = getFirstHeaderValue(headers[ACTIVE_HOTEL_HEADER_NAME]);

  if (!rawHeaderValue) {
    return undefined;
  }

  if (rawHeaderValue === ACTIVE_HOTEL_GLOBAL_VALUE) {
    return null;
  }

  return rawHeaderValue;
}

export function resolveActiveHotelContext(
  session: Pick<SessionPayload, "roleAssignments">,
  headers: Record<string, HeaderValue>
): ActiveHotelValidationResult {
  const requestedActiveHotelId = parseRequestedActiveHotelId(headers);
  const hasGlobalScope = canAccessGlobalScope(session);
  const accessibleHotelIds = listAccessibleHotelIds(session);

  if (requestedActiveHotelId === undefined) {
    if (hasGlobalScope) {
      return { ok: true, activeHotelId: null };
    }

    return {
      ok: true,
      activeHotelId: accessibleHotelIds[0] || null
    };
  }

  if (requestedActiveHotelId === null) {
    if (!hasGlobalScope) {
      return {
        ok: false,
        statusCode: 403,
        message: "Contexto global nao permitido para este usuario."
      };
    }

    return { ok: true, activeHotelId: null };
  }

  if (!accessibleHotelIds.includes(requestedActiveHotelId)) {
    return {
      ok: false,
      statusCode: 403,
      message: "Hotel ativo nao permitido para este usuario."
    };
  }

  return { ok: true, activeHotelId: requestedActiveHotelId };
}
