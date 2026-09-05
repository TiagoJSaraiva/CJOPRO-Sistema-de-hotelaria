import { describe, expect, it } from "vitest";
import { Check } from "typebox/value";
import {
  ConsumptionAnalyticsDimensionSchema,
  ConsumptionManagementSettingsBodySchema,
  PartnerSettlementCreateBodySchema,
  PartnerSettlementDecisionBodySchema,
  PartnerSettlementPaymentBodySchema,
  PartnerSettlementPaymentReversalBodySchema,
} from "../../src/api-contract";

describe("consumption management contracts", () => {
  it("accepts supported analytical dimensions only", () => {
    for (const dimension of [
      "day",
      "point",
      "category",
      "product",
      "stay",
      "billing_mode",
      "payment_method",
      "provider",
      "partner",
      "operator",
    ])
      expect(Check(ConsumptionAnalyticsDimensionSchema, dimension)).toBe(true);
    expect(Check(ConsumptionAnalyticsDimensionSchema, "hotel")).toBe(false);
  });

  it("validates settings limits and monthly tracking dates", () => {
    const valid = {
      settlement_tracking_starts_on: "2026-08-01",
      payment_due_days: 5,
      agreement_expiry_alert_days: 30,
      guest_balance_alert_days: 0,
    };
    expect(Check(ConsumptionManagementSettingsBodySchema, valid)).toBe(true);
    expect(
      Check(ConsumptionManagementSettingsBodySchema, {
        ...valid,
        payment_due_days: -1,
      }),
    ).toBe(false);
    expect(
      Check(ConsumptionManagementSettingsBodySchema, {
        ...valid,
        settlement_tracking_starts_on: "08/2026",
      }),
    ).toBe(false);
  });

  it("requires a partner and first day of the month when creating", () => {
    expect(
      Check(PartnerSettlementCreateBodySchema, {
        partner_id: "b0000000-0000-4000-8000-000000000001",
        period_start: "2026-08-01",
      }),
    ).toBe(true);
    expect(
      Check(PartnerSettlementCreateBodySchema, {
        partner_id: "not-an-id",
        period_start: "2026-08-15",
      }),
    ).toBe(false);
  });

  it("models review decisions, exact payment and compensating reversal", () => {
    expect(
      Check(PartnerSettlementDecisionBodySchema, {
        expected_version: 2,
        decision: "approve",
      }),
    ).toBe(true);
    expect(
      Check(PartnerSettlementDecisionBodySchema, {
        expected_version: 2,
        decision: "invalid",
      }),
    ).toBe(false);
    expect(
      Check(PartnerSettlementPaymentBodySchema, {
        expected_version: 3,
        amount: 125.5,
        payment_method: "pix",
        paid_at: "2026-09-05T12:00:00.000Z",
        idempotency_key: "b7000000-0000-4000-8000-000000000099",
      }),
    ).toBe(true);
    expect(
      Check(PartnerSettlementPaymentBodySchema, {
        expected_version: 3,
        amount: 0,
        payment_method: "pix",
        paid_at: "2026-09-05T12:00:00.000Z",
        idempotency_key: "b7000000-0000-4000-8000-000000000099",
      }),
    ).toBe(false);
    expect(
      Check(PartnerSettlementPaymentReversalBodySchema, {
        reason: "Baixa registrada no parceiro errado",
        reversed_at: "2026-09-05T12:00:00.000Z",
        idempotency_key: "b7000000-0000-4000-8000-000000000098",
      }),
    ).toBe(true);
  });
});
