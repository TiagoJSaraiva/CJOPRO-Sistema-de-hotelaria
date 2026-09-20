// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsumptionOffersManager } from "../../../../src/app/dashboard/consumption/_components/ConsumptionOffersManager";

vi.mock("../../../../src/app/dashboard/consumption/actions", () => ({
  archiveConsumptionOfferAction: vi.fn(),
  createConsumptionOffersAction: vi.fn(),
  reorderConsumptionOffersAction: vi.fn(),
  updateConsumptionOfferAction: vi.fn(),
}));

afterEach(cleanup);

describe("ConsumptionOffersManager inventory origins", () => {
  it("offers only active positions for the selected product", async () => {
    const user = userEvent.setup();
    render(
      <ConsumptionOffersManager
        points={[
          {
            id: "point-1",
            hotel_id: "hotel-1",
            name: "Café",
            internal_code: "CAFE",
            description: null,
            display_order: 0,
            is_active: true,
            default_policy: {
              allowed_modes: ["hotel_immediate"],
              default_mode: "hotel_immediate",
            },
            default_inventory_location: null,
            archived_at: null,
            created_at: "2026-09-01T10:00:00Z",
            updated_at: "2026-09-01T10:00:00Z",
            offers_count: 0,
            inherited_offers_count: 0,
          },
        ]}
        products={[
          {
            id: "product-1",
            hotel_id: "hotel-1",
            name: "Água",
            description: null,
            internal_code: "AGUA",
            kind: "physical",
            sales_unit: "unit",
            unit_price: 8,
            status: "active",
            archived_at: null,
            created_at: "2026-09-01T10:00:00Z",
            updated_at: "2026-09-01T10:00:00Z",
            category: {
              id: "category-1",
              hotel_id: "hotel-1",
              name: "Bebidas",
              display_order: 0,
              is_active: true,
              archived_at: null,
              created_at: "2026-09-01T10:00:00Z",
              updated_at: "2026-09-01T10:00:00Z",
            },
            provider: { type: "hotel", partner: null },
          },
        ]}
        offers={[]}
        agreements={[]}
        canManage
        inventoryOrigins={[]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: /Água/ }));
    expect(
      screen.getByText(/não compartilham uma posição ativa/i),
    ).toBeTruthy();
    expect(
      (
        screen.getByLabelText(
          "Sobrescrever origem do estoque",
        ) as HTMLSelectElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByRole("link", { name: /configure posições em Estoque/i }),
    ).toBeTruthy();
  });
});
