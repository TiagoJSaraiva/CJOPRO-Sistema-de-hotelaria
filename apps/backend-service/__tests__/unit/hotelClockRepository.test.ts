import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hotel: vi.fn(),
  rpc: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("../../src/common/supabaseServer", () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: (column: string, value: string) => {
          mocks.eq(column, value);
          return { maybeSingle: mocks.hotel };
        },
      }),
    }),
    rpc: mocks.rpc,
  }),
}));

import { createHotelClockRepository } from "../../src/repositories/hotelClockRepository";

const HOTEL = "10000000-0000-4000-8000-000000000001";

function answer(
  overrides: Partial<Record<"date" | "now", unknown>> = {},
  error: Error | null = null,
) {
  mocks.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "hotel_operational_date"
        ? "date" in overrides
          ? overrides.date
          : "2026-11-04"
        : "now" in overrides
          ? overrides.now
          : "2026-11-04T17:00:00+00:00",
    error,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hotel.mockResolvedValue({
    data: { timezone: "America/Sao_Paulo" },
    error: null,
  });
  answer();
});

describe("hotelClockRepository", () => {
  it("consulta o hotel informado e normaliza o instante", async () => {
    await expect(createHotelClockRepository().getClock(HOTEL)).resolves.toEqual(
      {
        timezone: "America/Sao_Paulo",
        operational_date: "2026-11-04",
        operational_now: "2026-11-04T17:00:00.000Z",
      },
    );
    expect(mocks.eq).toHaveBeenCalledWith("id", HOTEL);
    expect(mocks.rpc).toHaveBeenCalledWith("hotel_operational_date", {
      p_hotel_id: HOTEL,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("hotel_operational_now", {
      p_hotel_id: HOTEL,
    });
  });

  it("devolve nulo quando o hotel não existe", async () => {
    mocks.hotel.mockResolvedValue({ data: null, error: null });
    answer({ date: null, now: null });
    await expect(
      createHotelClockRepository().getClock(HOTEL),
    ).resolves.toBeNull();
  });

  it("propaga o erro do banco", async () => {
    const failure = new Error("falha");
    answer({}, failure);
    await expect(createHotelClockRepository().getClock(HOTEL)).rejects.toBe(
      failure,
    );
  });
});
