/**
 * i18n Translation Utilities
 * 
 * Centralized mapping for UI labels in pt-BR
 * Backend logic and enum values remain unchanged
 * All functions are pure and return fallback to original value if not found
 */

import type { RoomStatus, ReservationSource, ReservationStatus } from "./admin";

const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  available: "Disponível",
  occupied: "Ocupado",
  maintenance: "Manutenção",
  blocked: "Bloqueado",
};

const RESERVATION_SOURCE_LABELS: Record<ReservationSource, string> = {
  front_desk: "Recepção",
  website: "Website",
  phone: "Telefone",
  agency: "Agência",
};

const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  checked_in: "Check in realizado",
  checked_out: "Check out realizado",
  canceled: "Cancelada",
  no_show: "No show",
};

/**
 * Translate room status enum value to pt-BR label
 * @param status - Room status enum value (available, occupied, maintenance, blocked)
 * @returns Portuguese label or original value if not found
 */
export function translateRoomStatus(status: RoomStatus): string {
  return ROOM_STATUS_LABELS[status] ?? status;
}

/**
 * Translate reservation source enum value to pt-BR label
 * @param source - Reservation source enum value (front_desk, website, phone, agency)
 * @returns Portuguese label or original value if not found
 */
export function translateReservationSource(source: ReservationSource): string {
  return RESERVATION_SOURCE_LABELS[source] ?? source;
}

/**
 * Translate reservation status enum value to pt-BR label
 * @param status - Reservation status enum value (pending, confirmed, checked_in, checked_out, canceled, no_show)
 * @returns Portuguese label or original value if not found
 */
export function translateReservationStatus(status: ReservationStatus): string {
  return RESERVATION_STATUS_LABELS[status] ?? status;
}
