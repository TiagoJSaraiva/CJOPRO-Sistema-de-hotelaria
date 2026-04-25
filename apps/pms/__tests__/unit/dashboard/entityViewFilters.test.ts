import { describe, expect, it } from "vitest";
import type {
  AdminCustomer,
  AdminProduct,
  AdminReservation,
  AdminRoom,
  AdminSeason,
  AdminSeasonRoomRate
} from "@hotel/shared";
import { applyRoomViewFilters, countAppliedRoomFilters, DEFAULT_ROOM_VIEW_FILTERS } from "../../../src/app/dashboard/rooms/_components/roomViewFilters";
import {
  applyCustomerViewFilters,
  countAppliedCustomerFilters,
  DEFAULT_CUSTOMER_VIEW_FILTERS
} from "../../../src/app/dashboard/customers/_components/customerViewFilters";
import {
  applyReservationViewFilters,
  countAppliedReservationFilters,
  DEFAULT_RESERVATION_VIEW_FILTERS
} from "../../../src/app/dashboard/reservations/_components/reservationViewFilters";
import {
  applyProductViewFilters,
  countAppliedProductFilters,
  DEFAULT_PRODUCT_VIEW_FILTERS
} from "../../../src/app/dashboard/products/_components/productViewFilters";
import { applySeasonViewFilters, countAppliedSeasonFilters, DEFAULT_SEASON_VIEW_FILTERS } from "../../../src/app/dashboard/seasons/_components/seasonViewFilters";
import {
  applySeasonRoomRateViewFilters,
  countAppliedSeasonRoomRateFilters,
  DEFAULT_SEASON_ROOM_RATE_VIEW_FILTERS
} from "../../../src/app/dashboard/season-room-rates/_components/seasonRoomRateViewFilters";

describe("entity view filters", () => {
  it("filtra quartos por busca, status e capacidade", () => {
    const rooms: AdminRoom[] = [
      { id: "r1", hotel_id: "h1", room_number: "101", room_type: "suite", max_occupancy: 3, base_daily_rate: 150, status: "available", notes: "vista" },
      { id: "r2", hotel_id: "h1", room_number: "202", room_type: "standard", max_occupancy: 2, base_daily_rate: 120, status: "occupied", notes: null }
    ];

    const result = applyRoomViewFilters(rooms, { ...DEFAULT_ROOM_VIEW_FILTERS, search: "suite", status: "available", minOccupancy: "3" });

    expect(result.map((item) => item.id)).toEqual(["r1"]);
    expect(countAppliedRoomFilters({ ...DEFAULT_ROOM_VIEW_FILTERS, search: "suite", status: "available", minOccupancy: "3" })).toBe(3);
  });

  it("filtra clientes por busca, documento e nascimento", () => {
    const customers: AdminCustomer[] = [
      { id: "c1", hotel_id: "h1", full_name: "Maria Silva", document_number: "123", document_type: "CPF", email: "maria@hotel.com", mobile_phone: null, phone: null, birth_date: "1990-01-10", nationality: null, notes: null },
      { id: "c2", hotel_id: "h1", full_name: "Joao Pereira", document_number: "456", document_type: "RG", email: null, mobile_phone: null, phone: null, birth_date: "1985-05-20", nationality: null, notes: null }
    ];

    const result = applyCustomerViewFilters(customers, { ...DEFAULT_CUSTOMER_VIEW_FILTERS, search: "maria", documentType: "CPF", birthFrom: "1990-01-01", birthTo: "1990-12-31" });

    expect(result.map((item) => item.id)).toEqual(["c1"]);
    expect(countAppliedCustomerFilters({ ...DEFAULT_CUSTOMER_VIEW_FILTERS, search: "maria", documentType: "CPF", birthFrom: "1990-01-01" })).toBe(3);
  });

  it("filtra reservas por status, pagamento, origem e check-in", () => {
    const reservations: AdminReservation[] = [
      {
        id: "res1",
        hotel_id: "h1",
        booking_customer_id: "c1",
        reservation_code: "RES-1",
        planned_checkin_date: "2026-04-10",
        planned_checkout_date: "2026-04-12",
        actual_checkin_date: null,
        actual_checkout_date: null,
        guest_count: 2,
        reservation_status: "confirmed",
        reservation_source: "website",
        payment_status: "paid",
        estimated_total_amount: 500,
        final_total_amount: 500,
        notes: "vista",
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z"
      },
      {
        id: "res2",
        hotel_id: "h1",
        booking_customer_id: "c2",
        reservation_code: "RES-2",
        planned_checkin_date: "2026-05-10",
        planned_checkout_date: "2026-05-12",
        actual_checkin_date: null,
        actual_checkout_date: null,
        guest_count: 1,
        reservation_status: "pending",
        reservation_source: "front_desk",
        payment_status: "pending",
        estimated_total_amount: 200,
        final_total_amount: null,
        notes: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z"
      }
    ];

    const result = applyReservationViewFilters(reservations, {
      ...DEFAULT_RESERVATION_VIEW_FILTERS,
      search: "res-1",
      status: "confirmed",
      paymentStatus: "paid",
      source: "website",
      plannedCheckinFrom: "2026-04-01",
      plannedCheckinTo: "2026-04-30"
    });

    expect(result.map((item) => item.id)).toEqual(["res1"]);
    expect(countAppliedReservationFilters({ ...DEFAULT_RESERVATION_VIEW_FILTERS, status: "confirmed", paymentStatus: "paid", source: "website" })).toBe(3);
  });

  it("filtra produtos por busca, status e faixa de preco", () => {
    const products: AdminProduct[] = [
      { id: "p1", hotel_id: "h1", name: "Cafe", category: "Bebidas", unit_price: 12.5, status: "active", created_at: "2026-04-01T00:00:00.000Z", updated_at: "2026-04-01T00:00:00.000Z" },
      { id: "p2", hotel_id: "h1", name: "Jantar", category: "Restaurante", unit_price: 80, status: "inactive", created_at: "2026-04-01T00:00:00.000Z", updated_at: "2026-04-01T00:00:00.000Z" }
    ];

    const result = applyProductViewFilters(products, { ...DEFAULT_PRODUCT_VIEW_FILTERS, search: "cafe", status: "active", minPrice: "10", maxPrice: "20" });

    expect(result.map((item) => item.id)).toEqual(["p1"]);
    expect(countAppliedProductFilters({ ...DEFAULT_PRODUCT_VIEW_FILTERS, search: "cafe", status: "active" })).toBe(2);
  });

  it("filtra temporadas por nome, status e data", () => {
    const seasons: AdminSeason[] = [
      { id: "s1", hotel_id: "h1", name: "Alta", start_date: "2026-12-01", end_date: "2026-12-31", is_active: true, created_at: "2026-04-01T00:00:00.000Z", updated_at: "2026-04-01T00:00:00.000Z" },
      { id: "s2", hotel_id: "h1", name: "Baixa", start_date: "2026-03-01", end_date: "2026-03-31", is_active: false, created_at: "2026-04-01T00:00:00.000Z", updated_at: "2026-04-01T00:00:00.000Z" }
    ];

    const result = applySeasonViewFilters(seasons, { ...DEFAULT_SEASON_VIEW_FILTERS, search: "alta", status: "active", startFrom: "2026-12-01" });

    expect(result.map((item) => item.id)).toEqual(["s1"]);
    expect(countAppliedSeasonFilters({ ...DEFAULT_SEASON_VIEW_FILTERS, search: "alta", status: "active", startFrom: "2026-12-01" })).toBe(3);
  });

  it("filtra tarifas por temporada por sala, temporada e faixa de preco", () => {
    const items: AdminSeasonRoomRate[] = [
      { id: "sr1", season_id: "s1", hotel_id: "h1", room_type: "suite", daily_rate: 250, created_at: "2026-04-01T00:00:00.000Z", updated_at: "2026-04-01T00:00:00.000Z" },
      { id: "sr2", season_id: "s2", hotel_id: "h1", room_type: "standard", daily_rate: 120, created_at: "2026-04-01T00:00:00.000Z", updated_at: "2026-04-01T00:00:00.000Z" }
    ];

    const result = applySeasonRoomRateViewFilters(items, { ...DEFAULT_SEASON_ROOM_RATE_VIEW_FILTERS, search: "suite", seasonId: "s1", minRate: "200", maxRate: "300" });

    expect(result.map((item) => item.id)).toEqual(["sr1"]);
    expect(countAppliedSeasonRoomRateFilters({ ...DEFAULT_SEASON_ROOM_RATE_VIEW_FILTERS, search: "suite", seasonId: "s1" })).toBe(2);
  });
});