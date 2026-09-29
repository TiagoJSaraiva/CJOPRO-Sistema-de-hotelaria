import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("../../src/common/supabaseServer", () => ({
  createServerClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));

import { createConsumptionOrdersRepository } from "../../src/repositories/consumptionOrdersRepository";

beforeEach(() => vi.clearAllMocks());

it("finds a checked-in stay by room number, room label, reservation and guest within its hotel", async () => {
  const rows = [
    {
      id: "reservation-2",
      reservation_code: "LOCAL-AUR-002",
      booking_customer: { full_name: "Bruno Exemplo" },
      stays: [
        {
          id: "stay-2",
          room: { room_number: "102", room_type: "Luxo" },
          checkin_date_actual: "2026-09-20T14:00:00Z",
        },
      ],
    },
  ];
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  mocks.from.mockReturnValue(query);

  const repository = createConsumptionOrdersRepository();
  for (const term of ["102", "Quarto 102", "LOCAL-AUR-002", "Bruno Exemplo"]) {
    expect(await repository.listEligibleStays("aurora", term)).toHaveLength(1);
  }
  expect(await repository.listEligibleStays("aurora", "103")).toEqual([]);
  expect(query.eq).toHaveBeenCalledWith("hotel_id", "aurora");
  expect(query.eq).toHaveBeenCalledWith("stays.stay_status", "checked_in");
});

it("adapts the legacy RPC guest field to the public context and lets PostgreSQL choose the default time", async () => {
  mocks.rpc.mockResolvedValue({
    data: {
      result: "ok",
      stay: { id: "stay-2" },
      guests: [{ id: "customer-2", name: "Bruno Exemplo" }],
      offers: [{ offer_id: "offer-1", product_name: "Água mineral" }],
      occurred_at: "2026-09-21T19:05:05Z",
    },
    error: null,
  });

  const result = await createConsumptionOrdersRepository().getContext(
    "aurora",
    "stay-2",
  );

  expect(mocks.rpc).toHaveBeenCalledWith(
    "get_consumption_operational_context",
    {
      p_hotel_id: "aurora",
      p_stay_id: "stay-2",
    },
  );
  expect(result).toMatchObject({
    result: "ok",
    item: {
      guests: [{ id: "customer-2", full_name: "Bruno Exemplo" }],
      offers: [{ id: "offer-1", product_name: "Água mineral" }],
    },
  });
});
