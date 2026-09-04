import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";
import {
  ConsumptionCorrectionBodySchema,
  ConsumptionCorrectionDecisionBodySchema,
  ConsumptionCorrectionItemBodySchema,
  PartnerRefundConfirmationBodySchema,
  StayPaymentBatchBodySchema,
  StayPaymentTenderBodySchema,
  StayRefundBodySchema,
} from "../../src/api-contract";

const id = "d1000000-0000-4000-8000-000000000001";

describe("stay account contracts", () => {
  it("accepts positive multimeans tenders with account version and idempotency", () => {
    expect(
      Check(StayPaymentBatchBodySchema, [StayPaymentTenderBodySchema], {
        tenders: [
          { payment_method: "pix", amount: 60 },
          { payment_method: "cash", amount: 40, reference_code: null },
        ],
        expected_version: 4,
        idempotency_key: id,
      }),
    ).toBe(true);
    expect(
      Check(StayPaymentTenderBodySchema, {
        payment_method: "voucher",
        amount: 10,
      }),
    ).toBe(false);
    expect(
      Check(StayPaymentTenderBodySchema, {
        payment_method: "pix",
        amount: 0,
      }),
    ).toBe(false);
  });

  it("validates redutor correction values and two-person decisions", () => {
    expect(
      Check(
        ConsumptionCorrectionBodySchema,
        [ConsumptionCorrectionItemBodySchema],
        {
          kind: "partial_adjustment",
          reason: "Item não consumido",
          expected_version: 4,
          items: [
            {
              order_item_id: id,
              resulting_quantity: 1,
              additional_discount: 2,
            },
          ],
        },
      ),
    ).toBe(true);
    expect(
      Check(ConsumptionCorrectionItemBodySchema, {
        order_item_id: id,
        resulting_quantity: -1,
        additional_discount: 0,
      }),
    ).toBe(false);
    expect(
      Check(ConsumptionCorrectionDecisionBodySchema, {
        decision: "reject",
        reason: "Duplicidade",
      }),
    ).toBe(true);
  });

  it("requires an operational refund reason and supports external confirmation", () => {
    expect(
      Check(StayRefundBodySchema, {
        amount: 8,
        payment_method: "credit_card",
        reason: "Reembolso do ajuste",
        expected_version: 5,
        idempotency_key: id,
        method_override_reason: null,
      }),
    ).toBe(true);
    expect(
      Check(StayRefundBodySchema, {
        amount: -1,
        payment_method: "cash",
        reason: "x",
        expected_version: 5,
        idempotency_key: id,
      }),
    ).toBe(false);
    expect(
      Check(PartnerRefundConfirmationBodySchema, { reference_code: null }),
    ).toBe(true);
  });
});
