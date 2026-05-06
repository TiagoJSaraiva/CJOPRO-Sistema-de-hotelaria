import type { AdminReservation, ReservationSource, ReservationStatus } from "@hotel/shared";

export type ReservationViewFilters = {
  search: string;
  status: "all" | ReservationStatus;
  source: "all" | ReservationSource;
};

export const DEFAULT_RESERVATION_VIEW_FILTERS: ReservationViewFilters = {
  search: "",
  status: "all",
  source: "all"
};

export function countAppliedReservationFilters(filters: ReservationViewFilters): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.status !== "all") total += 1;
  if (filters.source !== "all") total += 1;

  return total;
}

export function applyReservationViewFilters(reservations: AdminReservation[], filters: ReservationViewFilters): AdminReservation[] {
  const search = filters.search.trim().toLocaleLowerCase();

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

    if (filters.source !== "all" && reservation.reservation_source !== filters.source) {
      return false;
    }

    return true;
  });
}
