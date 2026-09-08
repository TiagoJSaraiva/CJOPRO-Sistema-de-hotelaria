import { beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../src/common/supabaseServer", () => ({
  createServerClient: () => ({ rpc }),
}));
import { createOperationalPendingRepository } from "../../src/repositories/operationalPendingRepository";
beforeEach(() => vi.clearAllMocks());
it("encaminha hotel, identidade e permissões em leitura e ações", async () => {
  const repository = createOperationalPendingRepository();
  rpc.mockResolvedValueOnce({ data: { items: [], total: 0 }, error: null });
  expect(
    await repository.list("hotel", "user", ["read_inventory"], { page: "2" }),
  ).toEqual({ items: [], total: 0 });
  expect(rpc).toHaveBeenLastCalledWith("list_operational_pending", {
    p_hotel_id: "hotel",
    p_user_id: "user",
    p_permissions: ["read_inventory"],
    p_filters: { page: "2" },
  });
  rpc.mockResolvedValue({ data: { result: "ok" }, error: null });
  expect(
    await repository.act("hotel", "user", [], {
      ids: ["id"],
      action: "claim",
      expected_version: 3,
    }),
  ).toBe("ok");
  expect(rpc).toHaveBeenLastCalledWith(
    "act_operational_pending",
    expect.objectContaining({
      p_version: 3,
      p_user_id: "user",
      p_hotel_id: "hotel",
    }),
  );
  expect(
    await repository.act("hotel", "user", [], { ids: ["id"], action: "read" }),
  ).toBe("ok");
  expect(await repository.reconcile("hotel")).toBe("ok");
  expect(rpc).toHaveBeenLastCalledWith("reconcile_operational_pending", {
    p_hotel_id: "hotel",
  });
});
it("não mascara falhas de origem ou respostas malformadas", async () => {
  const repository = createOperationalPendingRepository();
  rpc.mockResolvedValue({
    data: null,
    error: new Error("origem indisponível"),
  });
  await expect(repository.list("h", "u", [], {})).rejects.toThrow(
    "origem indisponível",
  );
  await expect(
    repository.act("h", "u", [], { ids: ["i"], action: "read" }),
  ).rejects.toThrow();
  await expect(repository.reconcile("h")).rejects.toThrow();
  rpc.mockResolvedValue({ data: [], error: null });
  expect(await repository.reconcile("h")).toBe("failed");
});
