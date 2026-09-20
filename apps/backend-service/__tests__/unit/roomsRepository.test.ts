import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock("../../src/common/supabaseServer", () => ({
  createServerClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));

import { createRoomsRepository } from "../../src/repositories/roomsRepository";

class Query implements PromiseLike<{ data: unknown; error: null }> {
  constructor(private readonly data: unknown) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  is() {
    return this;
  }
  lte() {
    return this;
  }
  order() {
    return Promise.resolve({ data: this.data, error: null });
  }
  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: unknown;
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.data, error: null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

it("consulta bloqueios pela data operacional do hotel", async () => {
  const blockQuery = new Query([]);
  const lte = vi.spyOn(blockQuery, "lte");
  mocks.from.mockImplementation((table: string) =>
    table === "rooms"
      ? new Query([
          {
            id: "room-1",
            hotel_id: "hotel-1",
            room_number: "101",
            room_type: "Standard",
            status: "available",
          },
        ])
      : blockQuery,
  );
  mocks.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "hotel_operational_date" ? "2030-02-03" : { readiness: "ready" },
    error: null,
  }));

  const rooms = await createRoomsRepository().listRooms("hotel-1");

  expect(rooms).toHaveLength(1);
  expect(lte).toHaveBeenCalledWith("start_date", "2030-02-03");
});
