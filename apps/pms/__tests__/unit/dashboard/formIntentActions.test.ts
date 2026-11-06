import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  request: vi.fn(),
  decideCorrection: vi.fn(),
  decideSettlement: vi.fn(),
  cancelCount: vi.fn(),
  completeCount: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("../../../src/lib/auth", () => ({ getUserFromSession: mocks.user }));
vi.mock("../../../src/lib/adminApi", () => ({
  requestOperationsFinanceEndpoint: mocks.request,
  decideConsumptionCorrection: mocks.decideCorrection,
  decidePartnerSettlement: mocks.decideSettlement,
  cancelInventoryCount: mocks.cancelCount,
  completeInventoryCount: mocks.completeCount,
}));

import { decideCashDifferenceAction } from "../../../src/app/dashboard/cash/actions";
import { decideConsumptionCorrectionAction } from "../../../src/app/dashboard/consumption/accountActions";
import {
  decideSettlementAction,
  decideSettlementDisputeAction,
} from "../../../src/app/dashboard/consumption/managementActions";
import { finishInventoryCountAction } from "../../../src/app/dashboard/inventory/actions";
import {
  actProcurementInvoiceAction,
  actPurchaseOrderAction,
  actReplenishmentAction,
} from "../../../src/app/dashboard/procurement/actions";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.mockResolvedValue({});
  mocks.user.mockResolvedValue({ permissions: Object.values(PERMISSIONS) });
});

describe("sem a intenção do botão, nada acontece por omissão", () => {
  it("correção de consumo não é aprovada", async () => {
    await expect(
      decideConsumptionCorrectionAction(form({ record_id: "correction" })),
    ).rejects.toThrow("status=invalid");
    expect(mocks.decideCorrection).not.toHaveBeenCalled();
  });

  it("apuração não é aprovada", async () => {
    await expect(
      decideSettlementAction(
        form({ record_id: "settlement", expected_version: "3" }),
      ),
    ).rejects.toThrow("status=invalid_decision");
    expect(mocks.decideSettlement).not.toHaveBeenCalled();
  });

  it("contagem de estoque não é concluída", async () => {
    await expect(
      finishInventoryCountAction(form({ record_id: "count" })),
    ).rejects.toThrow("invalid");
    expect(mocks.completeCount).not.toHaveBeenCalled();
    expect(mocks.cancelCount).not.toHaveBeenCalled();
  });
});

describe("cada botão faz o que diz", () => {
  it("rejeitar apuração rejeita", async () => {
    mocks.decideSettlement.mockResolvedValue({});
    await expect(
      decideSettlementAction(
        form({
          record_id: "settlement",
          expected_version: "3",
          decision: "reject",
          reason: "Fonte divergente",
        }),
      ),
    ).rejects.toThrow("status=rejected");
    expect(mocks.decideSettlement).toHaveBeenCalledWith("settlement", {
      expected_version: 3,
      decision: "reject",
      reason: "Fonte divergente",
    });
  });

  it("aprovar apuração aprova", async () => {
    mocks.decideSettlement.mockResolvedValue({});
    await expect(
      decideSettlementAction(
        form({
          record_id: "settlement",
          expected_version: "3",
          decision: "approve",
        }),
      ),
    ).rejects.toThrow("status=approved");
    expect(mocks.decideSettlement.mock.calls[0]![1].decision).toBe("approve");
  });

  it("rejeitar correção rejeita, com motivo", async () => {
    mocks.decideCorrection.mockResolvedValue({});
    await expect(
      decideConsumptionCorrectionAction(
        form({
          record_id: "correction",
          decision: "reject",
          reason: "Sem evidência",
        }),
      ),
    ).rejects.toThrow("status=rejected");
    expect(mocks.decideCorrection).toHaveBeenCalledWith("correction", {
      decision: "reject",
      reason: "Sem evidência",
    });
  });

  it("cancelar contagem cancela, e concluir conclui", async () => {
    await expect(
      finishInventoryCountAction(form({ record_id: "c", action: "cancel" })),
    ).rejects.toThrow("REDIRECT");
    expect(mocks.cancelCount).toHaveBeenCalledWith("c");
    expect(mocks.completeCount).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ permissions: Object.values(PERMISSIONS) });
    await expect(
      finishInventoryCountAction(form({ record_id: "c", action: "complete" })),
    ).rejects.toThrow("REDIRECT");
    expect(mocks.completeCount).toHaveBeenCalledWith("c");
    expect(mocks.cancelCount).not.toHaveBeenCalled();
  });
});

describe("as ações leem o registro e a decisão do formulário", () => {
  const decision = {
    record_id: "record",
    version: "2",
    action: "approve",
    reason: "Conferido",
  };

  it.each([
    [
      "diferença de caixa",
      decideCashDifferenceAction,
      "cash-sessions/record/actions",
    ],
    [
      "contestação",
      decideSettlementDisputeAction,
      "consumption/partner-disputes/record/actions",
    ],
    [
      "reposição",
      actReplenishmentAction,
      "procurement/replenishment-requests/record/actions",
    ],
    [
      "pedido de compra",
      actPurchaseOrderAction,
      "procurement/purchase-orders/record/actions",
    ],
    [
      "nota de compra",
      actProcurementInvoiceAction,
      "procurement/invoices/record/actions",
    ],
  ])("%s", async (_label, action, path) => {
    await expect(action(form(decision))).rejects.toThrow("REDIRECT");
    expect(mocks.request.mock.calls[0]![0]).toBe(path);
    expect(mocks.request.mock.calls[0]![2].action).toBe("approve");
  });
});
