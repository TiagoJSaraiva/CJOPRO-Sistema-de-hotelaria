import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";
import {
  API_ROUTE_CONTRACTS,
  ConsumptionOfferBatchBodySchema,
  ConsumptionOfferPolicySchema,
  ConsumptionPointBodySchema,
} from "../../src/api-contract";

const pointId = "a1000000-0000-4000-8000-000000000001";
const productId = "40000000-0000-4000-8000-000000000001";

describe("consumption settings contract", () => {
  it("accepts point defaults and inherited or overridden offers", () => {
    expect(
      Check(ConsumptionPointBodySchema, {
        name: "Frigobar",
        default_policy: {
          allowed_modes: ["hotel_immediate", "stay_folio"],
          default_mode: "stay_folio",
        },
      }),
    ).toBe(true);
    expect(Check(ConsumptionOfferPolicySchema, { source: "inherit" })).toBe(
      true,
    );
    expect(
      Check(ConsumptionOfferPolicySchema, {
        source: "override",
        allowed_modes: ["hotel_immediate"],
        default_mode: "hotel_immediate",
      }),
    ).toBe(true);
  });

  it("rejects empty, duplicate and incomplete policy shapes", () => {
    expect(
      Check(ConsumptionPointBodySchema, {
        name: "Frigobar",
        default_policy: { allowed_modes: [], default_mode: "stay_folio" },
      }),
    ).toBe(false);
    expect(
      Check(ConsumptionOfferPolicySchema, {
        source: "override",
        allowed_modes: ["stay_folio", "stay_folio"],
        default_mode: "stay_folio",
      }),
    ).toBe(false);
    expect(Check(ConsumptionOfferPolicySchema, { source: "override" })).toBe(
      false,
    );
  });

  it("validates an atomic product batch", () => {
    expect(
      Check(ConsumptionOfferBatchBodySchema, {
        product_ids: [productId],
        policy: { source: "inherit" },
      }),
    ).toBe(true);
    expect(
      Check(ConsumptionOfferBatchBodySchema, {
        product_ids: [productId, productId],
        policy: { source: "inherit" },
      }),
    ).toBe(false);
  });

  it("publishes configuration lifecycle without hard deletion", () => {
    expect(
      API_ROUTE_CONTRACTS["DELETE /admin/consumption-points/:id"],
    ).toBeUndefined();
    expect(
      API_ROUTE_CONTRACTS["POST /admin/consumption-points/:id/archive"],
    ).toBeDefined();
    expect(
      API_ROUTE_CONTRACTS["POST /admin/consumption-offers/:id/restore"],
    ).toBeDefined();
    expect(
      API_ROUTE_CONTRACTS["POST /admin/consumption-points/:id/offers"]?.params,
    ).toBeDefined();
    expect(pointId).toMatch(/^[a-f0-9-]+$/);
  });
});
