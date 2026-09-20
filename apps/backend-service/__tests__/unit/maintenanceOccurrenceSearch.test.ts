import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("../../src/common/supabaseServer", () => ({
  createServerClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
import { createMaintenanceRepository } from "../../src/repositories/maintenanceRepository";
function setup(error: Error | null = null, data: unknown[] = []) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    range: vi.fn().mockResolvedValue({ data, count: data.length, error }),
  };
  for (const method of [
    query.select,
    query.eq,
    query.is,
    query.gte,
    query.lte,
    query.ilike,
    query.order,
  ])
    method.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  return query;
}
it("calcula atraso com o relógio operacional do hotel", async () => {
  setup(null, [
    {
      id: "occurrence-1",
      occurrence_number: 1,
      category_id: "category-1",
      reported_by: "actor-1",
      maintenance_work_orders: [
        { status: "assigned", due_at: "2029-01-01T00:00:00.000Z" },
      ],
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    },
  ]);
  mocks.rpc.mockResolvedValue({
    data: "2030-01-01T00:00:00.000Z",
    error: null,
  });
  const result = await createMaintenanceRepository().listOccurrences("hotel", {
    page: 1,
    pageSize: 20,
    overdue: true,
  });
  expect(result.items).toHaveLength(1);
  expect(mocks.rpc).toHaveBeenCalledWith("hotel_operational_now", {
    p_hotel_id: "hotel",
  });
});
it("preserva busca textual paginada e escopo do hotel", async () => {
  const query = setup();
  expect(
    await createMaintenanceRepository().listOccurrences("hotel", {
      page: 2,
      pageSize: 20,
      search: "Vazamento",
    }),
  ).toEqual({ items: [], total: 0, page: 2, page_size: 20 });
  expect(query.eq).toHaveBeenCalledWith("hotel_id", "hotel");
  expect(query.ilike).toHaveBeenCalledWith("description", "%Vazamento%");
  expect(query.range).toHaveBeenCalledWith(20, 39);
});
it("busca código canônico por alvo, período e situação", async () => {
  const query = setup();
  await createMaintenanceRepository().listOccurrences("hotel", {
    page: 1,
    pageSize: 20,
    search: "OCO-000042",
    canonical: true,
    roomId: "room",
    locationId: "location",
    status: "triaged",
    createdFrom: "2026-09-01",
    createdTo: "2026-09-08",
  });
  expect(query.eq).toHaveBeenCalledWith("occurrence_number", 42);
  expect(query.is).toHaveBeenCalledWith("duplicate_of_id", null);
  expect(query.eq).toHaveBeenCalledWith("room_id", "room");
  expect(query.eq).toHaveBeenCalledWith("location_id", "location");
  expect(query.eq).toHaveBeenCalledWith("status", "triaged");
  expect(query.gte).toHaveBeenCalledWith("created_at", "2026-09-01");
  expect(query.lte).toHaveBeenCalledWith(
    "created_at",
    "2026-09-08T23:59:59.999999Z",
  );
  expect(query.ilike).not.toHaveBeenCalled();
});
it("propaga falha de consulta sem retornar lista vazia", async () => {
  setup(new Error("offline"));
  await expect(
    createMaintenanceRepository().listOccurrences("hotel", {
      page: 1,
      pageSize: 20,
    }),
  ).rejects.toThrow("offline");
});
