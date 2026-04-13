import type { AdminHotel } from "@hotel/shared";

export type HotelFilterStatus = "all" | "active" | "inactive";

export type HotelViewFilters = {
  search: string;
  status: HotelFilterStatus;
  city: string;
  state: string;
  country: string;
};

export const DEFAULT_HOTEL_VIEW_FILTERS: HotelViewFilters = {
  search: "",
  status: "all",
  city: "",
  state: "",
  country: ""
};

export function countAppliedHotelFilters(filters: HotelViewFilters): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.status !== "all") total += 1;
  if (filters.city.trim()) total += 1;
  if (filters.state.trim()) total += 1;
  if (filters.country.trim()) total += 1;

  return total;
}

export function applyHotelViewFilters(hotels: AdminHotel[], filters: HotelViewFilters): AdminHotel[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const city = filters.city.trim().toLocaleLowerCase();
  const state = filters.state.trim().toLocaleLowerCase();
  const country = filters.country.trim().toLocaleLowerCase();

  return hotels.filter((hotel) => {
    if (search) {
      const haystack = `${hotel.name} ${hotel.slug}`.toLocaleLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (filters.status === "active" && !hotel.is_active) {
      return false;
    }

    if (filters.status === "inactive" && hotel.is_active) {
      return false;
    }

    if (city && !String(hotel.city || "").toLocaleLowerCase().includes(city)) {
      return false;
    }

    if (state && !String(hotel.state || "").toLocaleLowerCase().includes(state)) {
      return false;
    }

    if (country && !String(hotel.country || "").toLocaleLowerCase().includes(country)) {
      return false;
    }

    return true;
  });
}
