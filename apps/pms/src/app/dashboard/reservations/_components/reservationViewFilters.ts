import type { AdminReservation, ReservationPaymentStatus, ReservationSource, ReservationStatus } from "@hotel/shared";

export type ReservationViewFilters = {
  search: string;
  status: "all" | ReservationStatus;
  paymentStatus: "all" | ReservationPaymentStatus;
  source: "all" | ReservationSource;
  plannedCheckinFrom: string;
  plannedCheckinTo: string;
};

export const DEFAULT_RESERVATION_VIEW_FILTERS: ReservationViewFilters = {
  search: "",
  status: "all",
  paymentStatus: "all",
  source: "all",
  plannedCheckinFrom: "",
  plannedCheckinTo: ""
};

function parseDateStart(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const timestamp = new Date(year, month - 1, day).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function parseDateEnd(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const timestamp = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function countAppliedReservationFilters(filters: ReservationViewFilters): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.status !== "all") total += 1;
  if (filters.paymentStatus !== "all") total += 1;
  if (filters.source !== "all") total += 1;
  if (filters.plannedCheckinFrom.trim()) total += 1;
  if (filters.plannedCheckinTo.trim()) total += 1;

  return total;
}

export function applyReservationViewFilters(reservations: AdminReservation[], filters: ReservationViewFilters): AdminReservation[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const plannedCheckinFrom = parseDateStart(filters.plannedCheckinFrom);
  const plannedCheckinTo = parseDateEnd(filters.plannedCheckinTo);

  return reservations.filter((reservation) => {
    if (search) {
      const haystack = `${reservation.reservation_code} ${reservation.booking_customer_id} ${reservation.notes || ""}`.toLocaleLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (filters.status !== "all" && reservation.reservation_status !== filters.status) {
      return false;
    }

    if (filters.paymentStatus !== "all" && reservation.payment_status !== filters.paymentStatus) {
      return false;
    }

    if (filters.source !== "all" && reservation.reservation_source !== filters.source) {
      return false;
    }

    if (plannedCheckinFrom !== null || plannedCheckinTo !== null) {
      const plannedCheckinAt = new Date(`${reservation.planned_checkin_date}T00:00:00`).getTime();

      if (Number.isNaN(plannedCheckinAt)) {
        return false;
      }

      if (plannedCheckinFrom !== null && plannedCheckinAt < plannedCheckinFrom) {
        return false;
      }

      if (plannedCheckinTo !== null && plannedCheckinAt > plannedCheckinTo) {
        return false;
      }
    }

    return true;
  });
}