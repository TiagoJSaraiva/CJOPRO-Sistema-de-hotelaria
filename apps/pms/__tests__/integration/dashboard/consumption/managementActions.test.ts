import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const {
  redirectMock,
  revalidatePathMock,
  getUserFromSessionMock,
  createPartnerSettlementMock,
  decidePartnerSettlementMock,
  payPartnerSettlementMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePathMock: vi.fn(),
  getUserFromSessionMock: vi.fn(),
  createPartnerSettlementMock: vi.fn(),
  decidePartnerSettlementMock: vi.fn(),
  payPartnerSettlementMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: getUserFromSessionMock,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  createPartnerSettlement: createPartnerSettlementMock,
  decidePartnerSettlement: decidePartnerSettlementMock,
  payPartnerSettlement: payPartnerSettlementMock,
  recalculatePartnerSettlement: vi.fn(),
  reversePartnerSettlementPayment: vi.fn(),
  submitPartnerSettlement: vi.fn(),
  updateConsumptionManagementSettings: vi.fn(),
}));

import {
  createSettlementAction,
  decideSettlementAction,
  paySettlementAction,
} from "../../../../src/app/dashboard/consumption/managementActions";

describe("dashboard/consumption/managementActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("impede a preparação sem a permissão independente", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [] });

    await expect(createSettlementAction(new FormData())).rejects.toThrow(
      "REDIRECT:/dashboard/consumption/settlements?status=forbidden",
    );
    expect(createPartnerSettlementMock).not.toHaveBeenCalled();
  });

  it("cria uma apuração mensal e abre sua ficha", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({
      permissions: [PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE],
    });
    createPartnerSettlementMock.mockResolvedValueOnce({ id: "settlement-1" });
    const formData = new FormData();
    formData.set("partner_id", "partner-1");
    formData.set("period_start", "2026-08-01");

    await expect(createSettlementAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/consumption/settlements?status=created&id=settlement-1",
    );
    expect(createPartnerSettlementMock).toHaveBeenCalledWith({
      partner_id: "partner-1",
      period_start: "2026-08-01",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/dashboard/consumption/settlements",
    );
  });

  it("envia a decisão com a versão e o motivo informados", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({
      permissions: [PERMISSIONS.PARTNER_SETTLEMENTS_APPROVE],
    });
    const formData = new FormData();
    formData.set("id", "settlement-1");
    formData.set("expected_version", "3");
    formData.set("decision", "reject");
    formData.set("reason", "Revisar fonte divergente");

    await expect(decideSettlementAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/consumption/settlements?status=rejected&id=settlement-1",
    );
    expect(decidePartnerSettlementMock).toHaveBeenCalledWith("settlement-1", {
      expected_version: 3,
      decision: "reject",
      reason: "Revisar fonte divergente",
    });
  });

  it("registra a baixa integral com uma chave idempotente", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({
      permissions: [PERMISSIONS.PARTNER_SETTLEMENTS_SETTLE],
    });
    const formData = new FormData();
    formData.set("id", "settlement-1");
    formData.set("expected_version", "4");
    formData.set("amount", "275.50");
    formData.set("payment_method", "pix");
    formData.set("paid_at", "2026-09-05T12:00:00.000Z");

    await expect(paySettlementAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/consumption/settlements?status=settled&id=settlement-1",
    );
    expect(payPartnerSettlementMock).toHaveBeenCalledWith(
      "settlement-1",
      expect.objectContaining({
        expected_version: 4,
        amount: 275.5,
        payment_method: "pix",
        idempotency_key: expect.any(String),
      }),
    );
  });
});
