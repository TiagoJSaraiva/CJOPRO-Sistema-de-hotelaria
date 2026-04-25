import { describe, expect, it } from "vitest";
import { getRoomsDefaultRoute, type RoomsAccess } from "../../../src/app/dashboard/rooms/access";
import { getCustomersDefaultRoute, type CustomersAccess } from "../../../src/app/dashboard/customers/access";
import { getReservationsDefaultRoute, type ReservationsAccess } from "../../../src/app/dashboard/reservations/access";
import { getProductsDefaultRoute, type ProductsAccess } from "../../../src/app/dashboard/products/access";
import { getSeasonsDefaultRoute, type SeasonsAccess } from "../../../src/app/dashboard/seasons/access";
import { getSeasonRoomRatesDefaultRoute, type SeasonRoomRatesAccess } from "../../../src/app/dashboard/season-room-rates/access";

type AccessState = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

function makeAccessState(overrides: Partial<AccessState> = {}): AccessState {
  return {
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
    ...overrides
  };
}

describe("dashboard access default routes", () => {
  it("prioriza rota view quando canRead=true", () => {
    const access = makeAccessState({ canCreate: true, canRead: true });

    expect(getRoomsDefaultRoute(access as RoomsAccess)).toBe("/dashboard/rooms/view");
    expect(getCustomersDefaultRoute(access as CustomersAccess)).toBe("/dashboard/customers/view");
    expect(getReservationsDefaultRoute(access as ReservationsAccess)).toBe("/dashboard/reservations/view");
    expect(getProductsDefaultRoute(access as ProductsAccess)).toBe("/dashboard/products/view");
    expect(getSeasonsDefaultRoute(access as SeasonsAccess)).toBe("/dashboard/seasons/view");
    expect(getSeasonRoomRatesDefaultRoute(access as SeasonRoomRatesAccess)).toBe("/dashboard/season-room-rates/view");
  });

  it("retorna rota create quando canRead=false e canCreate=true", () => {
    const access = makeAccessState({ canCreate: true, canRead: false });

    expect(getRoomsDefaultRoute(access as RoomsAccess)).toBe("/dashboard/rooms/create");
    expect(getCustomersDefaultRoute(access as CustomersAccess)).toBe("/dashboard/customers/create");
    expect(getReservationsDefaultRoute(access as ReservationsAccess)).toBe("/dashboard/reservations/create");
    expect(getProductsDefaultRoute(access as ProductsAccess)).toBe("/dashboard/products/create");
    expect(getSeasonsDefaultRoute(access as SeasonsAccess)).toBe("/dashboard/seasons/create");
    expect(getSeasonRoomRatesDefaultRoute(access as SeasonRoomRatesAccess)).toBe("/dashboard/season-room-rates/create");
  });

  it("retorna null quando usuario nao tem read e nem create", () => {
    const access = makeAccessState({ canCreate: false, canRead: false, canUpdate: true, canDelete: true });

    expect(getRoomsDefaultRoute(access as RoomsAccess)).toBeNull();
    expect(getCustomersDefaultRoute(access as CustomersAccess)).toBeNull();
    expect(getReservationsDefaultRoute(access as ReservationsAccess)).toBeNull();
    expect(getProductsDefaultRoute(access as ProductsAccess)).toBeNull();
    expect(getSeasonsDefaultRoute(access as SeasonsAccess)).toBeNull();
    expect(getSeasonRoomRatesDefaultRoute(access as SeasonRoomRatesAccess)).toBeNull();
  });
});
