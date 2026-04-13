import { describe, expect, it } from "vitest";
import type { AdminHotel } from "@hotel/shared";
import { DEFAULT_HOTEL_VIEW_FILTERS, applyHotelViewFilters, countAppliedHotelFilters } from "../../../../src/app/dashboard/hotels/_components/hotelViewFilters";

function makeHotel(overrides: Partial<AdminHotel>): AdminHotel {
  return {
    id: overrides.id || "hotel-default",
    name: overrides.name || "Hotel",
    legal_name: overrides.legal_name ?? null,
    tax_id: overrides.tax_id ?? null,
    slug: overrides.slug || "hotel",
    phone: overrides.phone ?? null,
    address_line: overrides.address_line ?? null,
    address_number: overrides.address_number ?? null,
    address_complement: overrides.address_complement ?? null,
    district: overrides.district ?? null,
    city: overrides.city ?? null,
    state: overrides.state ?? null,
    country: overrides.country ?? null,
    zip_code: overrides.zip_code ?? null,
    timezone: overrides.timezone ?? null,
    currency: overrides.currency ?? null,
    email: overrides.email ?? null,
    is_active: overrides.is_active ?? true,
    created_at: overrides.created_at,
    updated_at: overrides.updated_at
  };
}

describe("hotelViewFilters", () => {
  const hotels: AdminHotel[] = [
    makeHotel({ id: "hotel-1", name: "Hotel Centro", slug: "hotel-centro", city: "Sao Paulo", state: "SP", country: "BR", is_active: true }),
    makeHotel({ id: "hotel-2", name: "Hotel Praia", slug: "hotel-praia", city: "Florianopolis", state: "SC", country: "BR", is_active: false }),
    makeHotel({ id: "hotel-3", name: "Ocean Suites", slug: "ocean-suites", city: "Lisboa", state: "LX", country: "PT", is_active: true })
  ];

  it("retorna todos sem filtros", () => {
    const result = applyHotelViewFilters(hotels, DEFAULT_HOTEL_VIEW_FILTERS);

    expect(result.map((item) => item.id)).toEqual(["hotel-1", "hotel-2", "hotel-3"]);
  });

  it("filtra por nome ou slug", () => {
    const result = applyHotelViewFilters(hotels, {
      ...DEFAULT_HOTEL_VIEW_FILTERS,
      search: "PRAIA"
    });

    expect(result.map((item) => item.id)).toEqual(["hotel-2"]);
  });

  it("filtra por status", () => {
    const result = applyHotelViewFilters(hotels, {
      ...DEFAULT_HOTEL_VIEW_FILTERS,
      status: "inactive"
    });

    expect(result.map((item) => item.id)).toEqual(["hotel-2"]);
  });

  it("combina cidade/estado/pais com regra AND", () => {
    const result = applyHotelViewFilters(hotels, {
      ...DEFAULT_HOTEL_VIEW_FILTERS,
      city: "sao",
      state: "sp",
      country: "br"
    });

    expect(result.map((item) => item.id)).toEqual(["hotel-1"]);
  });

  it("conta filtros aplicados", () => {
    const count = countAppliedHotelFilters({
      ...DEFAULT_HOTEL_VIEW_FILTERS,
      status: "active",
      country: "br"
    });

    expect(count).toBe(2);
  });
});
