import { describe, expect, it } from "vitest";
import { Check } from "typebox/value";
import {
  DepartureReviewSchema,
  PostCheckoutConsumptionActionSchema,
  PostCheckoutConsumptionCreateSchema,
  PostCheckoutPaymentInputSchema,
  maximizeBenefit,
  validatePayerAllocation,
} from "../../src";

describe("consumption journey rules", () => {
  it("maximizes value and breaks ties by expiration then grant", () => {
    expect(
      maximizeBenefit(18, [
        {
          id: "later",
          availableAmount: 20,
          expiresAt: "2026-12-01",
          grantedAt: "2026-01-01",
        },
        {
          id: "first",
          availableAmount: 10,
          expiresAt: "2026-10-01",
          grantedAt: "2026-02-01",
        },
        {
          id: "older",
          availableAmount: 10,
          expiresAt: "2026-10-01",
          grantedAt: "2026-01-01",
        },
      ]),
    ).toEqual([
      { id: "older", amount: 10 },
      { id: "first", amount: 8 },
    ]);
  });

  it("validates allocations in cents without floating-point drift", () => {
    expect(
      validatePayerAllocation(10, [{ amount: 3.33 }, { amount: 6.67 }]),
    ).toEqual({
      valid: true,
      allocatedAmount: 10,
      difference: 0,
    });
    expect(validatePayerAllocation(10, [{ amount: 9.99 }]).valid).toBe(false);
    expect(
      validatePayerAllocation(10, [{ amount: 0 }, { amount: 10 }]).valid,
    ).toBe(false);
  });

  it("requires evidence context, a reason and positive supplemental tenders", () => {
    const uuid = "a4400000-0000-4000-8000-000000000001";
    expect(
      Check(PostCheckoutConsumptionCreateSchema, {
        stay_id: uuid,
        occurred_at: "2026-09-01T10:00:00.000Z",
        report: "Item encontrado na vistoria",
        items: [{ offer_id: uuid, quantity: 1 }],
      }),
    ).toBe(true);
    expect(
      Check(PostCheckoutConsumptionCreateSchema, {
        stay_id: uuid,
        occurred_at: "2026-09-01T10:00:00.000Z",
        report: "  ",
        items: [],
      }),
    ).toBe(false);
    expect(
      Check(PostCheckoutConsumptionActionSchema, {
        action: "approve",
        expected_version: 1,
        reason: "Evidência conferida",
      }),
    ).toBe(true);
    expect(
      Check(PostCheckoutPaymentInputSchema, {
        expected_version: 2,
        idempotency_key: uuid,
        tenders: [{ payment_method: "pix", amount: 0 }],
      }),
    ).toBe(false);
    expect(
      Check(DepartureReviewSchema, {
        stay_id: uuid,
        ready: true,
        blockers: [],
        payer_balances: [],
        account_version: 2,
        updated_at: "2026-09-01T10:00:00.000Z",
      }),
    ).toBe(true);
  });
});
