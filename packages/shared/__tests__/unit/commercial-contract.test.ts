import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";
import {
  API_ROUTE_CONTRACTS,
  CommercialAgreementBodySchema,
  CommercialPartnerBodySchema,
  CommercialPartnerContactBodySchema,
  ProductBodySchema,
} from "../../src/api-contract";

const id = "a1000000-0000-4000-8000-000000000001";

describe("commercial partner contracts", () => {
  it("accepts partners, contacts and the three commercial shapes", () => {
    expect(
      Check(CommercialPartnerBodySchema, {
        trade_name: "Spa Azul",
        legal_name: "Spa Azul Ltda",
        email: "contato@spa.example",
      }),
    ).toBe(true);
    expect(
      Check(CommercialPartnerContactBodySchema, {
        name: "Ana",
        purpose: "financial",
        email: "ana@spa.example",
      }),
    ).toBe(true);
    for (const revision of [
      {
        commercial_model: "fixed_rent",
        fixed_rent: 1000,
        rent_frequency: "monthly",
      },
      { commercial_model: "revenue_share", commission_percentage: 12.5 },
      {
        commercial_model: "hybrid",
        fixed_rent: 500,
        rent_frequency: "monthly",
        commission_percentage: 8,
        minimum_guarantee: 900,
      },
    ])
      expect(
        Check(CommercialAgreementBodySchema, {
          partner_id: id,
          internal_number: "AC-1",
          revision: {
            starts_on: "2026-09-01",
            payment_recipient: "both",
            point_ids: [id],
            ...revision,
          },
        }),
      ).toBe(true);
  });

  it("rejects invalid enum, percentage and provider shape at contract level", () => {
    expect(
      Check(CommercialPartnerContactBodySchema, {
        name: "Ana",
        purpose: "unknown",
        email: "ana@spa.example",
      }),
    ).toBe(false);
    expect(
      Check(CommercialAgreementBodySchema, {
        partner_id: id,
        internal_number: "AC-1",
        revision: {
          starts_on: "2026-09-01",
          commercial_model: "revenue_share",
          commission_percentage: 101,
          payment_recipient: "hotel",
          point_ids: [id],
        },
      }),
    ).toBe(false);
    expect(
      Check(ProductBodySchema, {
        name: "Massagem",
        category_id: id,
        kind: "service",
        sales_unit: "service",
        unit_price: 100,
        provider_type: "partner",
        commercial_partner_id: id,
      }),
    ).toBe(true);
    expect(
      Check(CommercialAgreementBodySchema, {
        partner_id: id,
        internal_number: "AC-2",
        revision: {
          starts_on: "2026-09-01",
          commercial_model: "fixed_rent",
          fixed_rent: 500,
          rent_frequency: "monthly",
          commission_percentage: 8,
          payment_recipient: "hotel",
          point_ids: [id],
        },
      }),
    ).toBe(false);
  });

  it("publishes lifecycle and eligibility endpoints", () => {
    expect(
      API_ROUTE_CONTRACTS[
        "POST /admin/commercial-agreement-revisions/:id/activate"
      ],
    ).toBeDefined();
    expect(
      API_ROUTE_CONTRACTS[
        "POST /admin/commercial-agreement-revisions/:id/terminate"
      ],
    ).toBeDefined();
    expect(
      API_ROUTE_CONTRACTS["GET /admin/commercial-agreement-eligibility"],
    ).toBeDefined();
    expect(
      API_ROUTE_CONTRACTS["POST /admin/commercial-agreements/:id/archive"],
    ).toBeDefined();
    expect(
      API_ROUTE_CONTRACTS["DELETE /admin/commercial-partners/:id"],
    ).toBeUndefined();
  });
});
