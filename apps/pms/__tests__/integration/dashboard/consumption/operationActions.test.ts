import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PERMISSIONS,
  type AdminConsumptionOrderCreateInput,
} from "@hotel/shared";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), post: vi.fn() }));
vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: mocks.getUser,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  postConsumptionOrder: mocks.post,
}));

import { postConsumptionOrderAction } from "../../../../src/app/dashboard/consumption/operationActions";

const input: AdminConsumptionOrderCreateInput = {
  stay_id: "91000000-0000-4000-8000-000000000002",
  point_id: "a1000000-0000-4000-8000-000000000001",
  occurred_at: "2026-09-04T15:00:00.000Z",
  disposition: "charged",
  billing_mode: "stay_folio",
  idempotency_key: "c1000000-0000-4000-8000-000000000001",
  lines: [
    {
      offer_id: "a2000000-0000-4000-8000-000000000001",
      quantity: 1,
      version_token: "v1",
    },
  ],
};

describe("consumption operation action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an operator without post_consumption", async () => {
    mocks.getUser.mockResolvedValue({ permissions: [] });
    expect(await postConsumptionOrderAction(input)).toEqual({
      receipt: null,
      error: "Operação não autorizada.",
      conflict: false,
    });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("returns the complete receipt", async () => {
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.CONSUMPTION_POST],
    });
    mocks.post.mockResolvedValue({ id: "order-1" });
    expect(await postConsumptionOrderAction(input)).toEqual({
      receipt: { id: "order-1" },
      error: null,
      conflict: false,
    });
  });

  it("marks a concurrency conflict and maps ordinary failures", async () => {
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.CONSUMPTION_POST],
    });
    const conflict = Object.assign(new Error("Falha"), { statusCode: 409 });
    mocks.post.mockRejectedValueOnce(conflict);
    expect(await postConsumptionOrderAction(input)).toMatchObject({
      receipt: null,
      conflict: true,
      error: expect.stringContaining("carrinho foi preservado"),
    });
    mocks.post.mockRejectedValueOnce(new Error("Indisponível"));
    expect(await postConsumptionOrderAction(input)).toEqual({
      receipt: null,
      conflict: false,
      error: "Indisponível",
    });
  });
});
