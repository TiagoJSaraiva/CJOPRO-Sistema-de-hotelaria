import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";
import {
  API_ROUTE_CONTRACTS,
  ProductBodySchema,
  ProductCategoryBodySchema,
  ProductUpdateSchema,
} from "../../src/api-contract";

const categoryId = "41000000-0000-4000-8000-000000000001";

describe("product catalog contract", () => {
  it("accepts the required fields and supported enumerations", () => {
    expect(
      Check(ProductBodySchema, {
        name: "Massagem relaxante",
        category_id: categoryId,
        internal_code: "SPA-050",
        kind: "service",
        sales_unit: "service",
        unit_price: 180,
        status: "active",
      }),
    ).toBe(true);
  });

  it("rejects missing fields, invalid enumerations and empty internal codes", () => {
    expect(Check(ProductBodySchema, { name: "Água", unit_price: 8 })).toBe(
      false,
    );
    expect(
      Check(ProductBodySchema, {
        name: "Água",
        category_id: categoryId,
        kind: "digital",
        sales_unit: "bottle",
        unit_price: 8,
      }),
    ).toBe(false);
    expect(
      Check(ProductBodySchema, {
        name: "Água",
        category_id: categoryId,
        internal_code: "",
        kind: "physical",
        sales_unit: "unit",
        unit_price: 8,
      }),
    ).toBe(false);
  });

  it("supports partial edits and validates category inputs", () => {
    expect(Check(ProductUpdateSchema, { unit_price: 9 })).toBe(true);
    expect(
      Check(ProductCategoryBodySchema, {
        name: "Frigobar",
        display_order: 1,
        is_active: true,
      }),
    ).toBe(true);
    expect(
      Check(ProductCategoryBodySchema, { name: "", display_order: -1 }),
    ).toBe(false);
  });

  it("publishes archive, restore and history without hard deletion", () => {
    expect(API_ROUTE_CONTRACTS["DELETE /admin/products/:id"]).toBeUndefined();
    expect(
      API_ROUTE_CONTRACTS["POST /admin/products/:id/archive"],
    ).toBeDefined();
    expect(
      API_ROUTE_CONTRACTS["POST /admin/products/:id/restore"],
    ).toBeDefined();
    expect(
      API_ROUTE_CONTRACTS["GET /admin/products/:id/history"],
    ).toBeDefined();
  });
});
