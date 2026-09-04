import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";
import { ConsumptionOrderBodySchema } from "../../src/api-contract";

const base = {
  stay_id: "91000000-0000-4000-8000-000000000002",
  point_id: "a1000000-0000-4000-8000-000000000001",
  occurred_at: "2026-09-04T15:00:00.000Z",
  disposition: "charged",
  billing_mode: "stay_folio",
  idempotency_key: "c1000000-0000-4000-8000-000000000001",
  lines: [
    {
      offer_id: "a2000000-0000-4000-8000-000000000001",
      quantity: 2,
      version_token: "catalog-v1",
    },
  ],
};

describe("consumption order contract", () => {
  it("accepts a versioned multi-item folio order", () => {
    expect(
      Check(ConsumptionOrderBodySchema, {
        ...base,
        lines: [
          ...base.lines,
          {
            offer_id: "a2000000-0000-4000-8000-000000000002",
            quantity: 1,
            version_token: "catalog-v2",
          },
        ],
      }),
    ).toBe(true);
  });

  it("accepts immediate payment, partner confirmation and courtesy shapes", () => {
    expect(
      Check(ConsumptionOrderBodySchema, {
        ...base,
        billing_mode: "hotel_immediate",
        payment_method: "pix",
      }),
    ).toBe(true);
    expect(
      Check(ConsumptionOrderBodySchema, {
        ...base,
        billing_mode: "partner_direct",
        partner_receipt_confirmed: true,
      }),
    ).toBe(true);
    expect(
      Check(ConsumptionOrderBodySchema, {
        ...base,
        disposition: "courtesy",
        billing_mode: null,
        courtesy_reason: "Falha de serviço",
      }),
    ).toBe(true);
  });

  it("rejects missing lines, invalid quantity, date, UUID and payment method", () => {
    expect(Check(ConsumptionOrderBodySchema, { ...base, lines: [] })).toBe(
      false,
    );
    expect(
      Check(ConsumptionOrderBodySchema, {
        ...base,
        lines: [{ ...base.lines[0], quantity: 0 }],
      }),
    ).toBe(false);
    expect(
      Check(ConsumptionOrderBodySchema, {
        ...base,
        occurred_at: "ontem",
      }),
    ).toBe(false);
    expect(
      Check(ConsumptionOrderBodySchema, {
        ...base,
        idempotency_key: "repetir",
      }),
    ).toBe(false);
    expect(
      Check(ConsumptionOrderBodySchema, {
        ...base,
        payment_method: "voucher",
      }),
    ).toBe(false);
  });
});
