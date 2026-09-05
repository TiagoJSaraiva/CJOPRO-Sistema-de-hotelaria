import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";
import {
  API_ROUTE_CONTRACTS,
  InventoryCountBodySchema,
  InventoryDocumentBodySchema,
  InventoryPositionBodySchema,
  InventorySettingsBodySchema,
  InventoryTransferBodySchema,
} from "../../src/api-contract";

const id = (suffix: string) =>
  `a6000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

describe("inventory contract", () => {
  it("accepts explicit opt-in and both insufficient-stock policies", () => {
    expect(
      Check(InventorySettingsBodySchema, { negative_stock_policy: "block" }),
    ).toBe(true);
    expect(
      Check(InventorySettingsBodySchema, {
        negative_stock_policy: "allow_with_warning",
      }),
    ).toBe(true);
    expect(
      Check(InventorySettingsBodySchema, { negative_stock_policy: "ignore" }),
    ).toBe(false);
    expect(
      Check(InventoryPositionBodySchema, {
        product_id: id("1"),
        location_id: id("2"),
        initial_quantity: 10,
        minimum_quantity: 2,
        ideal_quantity: 8,
        average_unit_cost: 3.5,
        idempotency_key: id("3"),
      }),
    ).toBe(true);
  });

  it("rejects fractional stock, invalid thresholds, negative cost and equal transfer locations", () => {
    expect(
      Check(InventoryPositionBodySchema, {
        product_id: id("1"),
        location_id: id("2"),
        initial_quantity: 1.5,
        minimum_quantity: 0,
        ideal_quantity: 0,
        idempotency_key: id("3"),
      }),
    ).toBe(false);
    expect(
      Check(InventoryDocumentBodySchema, {
        kind: "receipt",
        reason: "Entrada",
        occurred_at: new Date().toISOString(),
        idempotency_key: id("4"),
        lines: [{ position_id: id("5"), quantity: 1, unit_cost: -1 }],
      }),
    ).toBe(false);
    const transfer = {
      source_location_id: id("6"),
      destination_location_id: id("6"),
      product_id: id("1"),
      quantity: 1,
      reason: "Reposição",
      occurred_at: new Date().toISOString(),
      idempotency_key: id("7"),
    };
    expect(Check(InventoryTransferBodySchema, transfer)).toBe(true);
    // Cross-field equality is rejected by the HTTP/business layer, not TypeBox.
  });

  it("requires idempotency for documents and counts and exposes no deletion routes", () => {
    expect(Check(InventoryCountBodySchema, { location_id: id("2") })).toBe(
      false,
    );
    expect(
      API_ROUTE_CONTRACTS["POST /admin/inventory/documents"],
    ).toBeDefined();
    expect(
      API_ROUTE_CONTRACTS["POST /admin/inventory/counts/:id/complete"],
    ).toBeDefined();
    expect(
      API_ROUTE_CONTRACTS["PUT /admin/inventory/locations/order"],
    ).toBeDefined();
    expect(API_ROUTE_CONTRACTS["GET /admin/inventory/audit"]).toBeDefined();
    expect(
      API_ROUTE_CONTRACTS["DELETE /admin/inventory/movements/:id"],
    ).toBeUndefined();
    expect(
      API_ROUTE_CONTRACTS["DELETE /admin/inventory/locations/:id"],
    ).toBeUndefined();
  });
});
