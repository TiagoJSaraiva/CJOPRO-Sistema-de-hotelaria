import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePath: vi.fn(),
  getUser: vi.fn(),
  getAccount: vi.fn(),
  createRefund: vi.fn(),
  requestCorrection: vi.fn(),
  decideCorrection: vi.fn(),
  confirmPartnerRefund: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: mocks.getUser,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  getStayAccount: mocks.getAccount,
  createStayRefund: mocks.createRefund,
  requestConsumptionCorrection: mocks.requestCorrection,
  decideConsumptionCorrection: mocks.decideCorrection,
  confirmPartnerCorrectionRefund: mocks.confirmPartnerRefund,
}));

import {
  confirmPartnerRefundAction,
  createCorrectionRefundAction,
  decideConsumptionCorrectionAction,
  requestConsumptionCorrectionAction,
  reverseStayPaymentAction,
} from "../../../../src/app/dashboard/consumption/accountActions";

describe("dashboard/consumption account actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccount.mockResolvedValue({ version: 7 });
  });

  it("records a correction refund with the current account version", async () => {
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE],
    });
    const form = new FormData();
    form.set("stay_id", "stay-1");
    form.set("correction_id", "correction-1");
    form.set("amount", "42.50");
    form.set("payment_method", "pix");
    form.set("reference_code", "PIX-42");

    await expect(createCorrectionRefundAction(form)).rejects.toThrow(
      "REDIRECT:/dashboard/reservations/account?stay_id=stay-1&status=refunded",
    );
    expect(mocks.createRefund).toHaveBeenCalledWith(
      "stay-1",
      expect.objectContaining({
        amount: 42.5,
        correction_id: "correction-1",
        expected_version: 7,
        payment_method: "pix",
        reference_code: "PIX-42",
      }),
    );
  });

  it("preserves a specific version conflict while reversing a payment", async () => {
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE],
    });
    mocks.createRefund.mockRejectedValue(
      Object.assign(new Error("Conta alterada"), {
        details: "version_conflict",
      }),
    );
    const form = new FormData();
    form.set("stay_id", "stay-1");
    form.set("original_tender_id", "tender-1");
    form.set("amount", "30");

    await expect(reverseStayPaymentAction(form)).rejects.toThrow(
      "REDIRECT:/dashboard/reservations/account?stay_id=stay-1&status=version-conflict",
    );
  });

  it("requests a partial correction with item reductions", async () => {
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.CONSUMPTION_POST],
    });
    const form = new FormData();
    form.set("order_id", "order-1");
    form.set("stay_id", "stay-1");
    form.set("kind", "partial_adjustment");
    form.set("reason", "Item não consumido");
    form.set("expected_version", "4");
    form.append("order_item_id", "item-1");
    form.append("resulting_quantity", "1");
    form.append("additional_discount", "5.25");

    await expect(requestConsumptionCorrectionAction(form)).rejects.toThrow(
      "REDIRECT:/dashboard/consumption/adjustments?status=adjustment-requested",
    );
    expect(mocks.requestCorrection).toHaveBeenCalledWith("order-1", {
      kind: "partial_adjustment",
      reason: "Item não consumido",
      expected_version: 4,
      items: [
        {
          order_item_id: "item-1",
          resulting_quantity: 1,
          additional_discount: 5.25,
        },
      ],
    });
  });

  it("requires the correct permission for a full void", async () => {
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.CONSUMPTION_POST],
    });
    const form = new FormData();
    form.set("kind", "full_void");

    await expect(requestConsumptionCorrectionAction(form)).rejects.toThrow(
      "REDIRECT:/dashboard/consumption/adjustments?status=forbidden",
    );
    expect(mocks.requestCorrection).not.toHaveBeenCalled();
  });

  it("approves a correction and confirms an external partner refund", async () => {
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.CONSUMPTION_ADJUSTMENT_APPROVE],
    });
    const decision = new FormData();
    decision.set("id", "correction-1");
    decision.set("decision", "approve");
    await expect(decideConsumptionCorrectionAction(decision)).rejects.toThrow(
      "REDIRECT:/dashboard/consumption/adjustments?status=approved",
    );
    expect(mocks.decideCorrection).toHaveBeenCalledWith("correction-1", {
      decision: "approve",
      reason: null,
    });

    const refund = new FormData();
    refund.set("id", "correction-1");
    refund.set("reference_code", "PARTNER-REF-1");
    await expect(confirmPartnerRefundAction(refund)).rejects.toThrow(
      "REDIRECT:/dashboard/consumption/adjustments?status=partner-refund-confirmed",
    );
    expect(mocks.confirmPartnerRefund).toHaveBeenCalledWith("correction-1", {
      reference_code: "PARTNER-REF-1",
    });
  });
});
