// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";
import { InventoryWorkspace } from "../../../../src/app/dashboard/inventory/_components/InventoryWorkspace";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  overview: vi.fn(),
  locations: vi.fn(),
  products: vi.fn(),
  movements: vi.fn(),
  audit: vi.fn(),
  counts: vi.fn(),
}));

vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: mocks.getUser,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  getInventoryOverview: mocks.overview,
  listInventoryLocations: mocks.locations,
  listProducts: mocks.products,
  listInventoryMovements: mocks.movements,
  listInventoryAuditEvents: mocks.audit,
  listInventoryCounts: mocks.counts,
}));
vi.mock(
  "../../../../src/app/dashboard/_components/DashboardEntityPageShell",
  () => ({
    DashboardEntityPageShell: ({
      title,
      statusContent,
      children,
    }: {
      title: string;
      statusContent?: React.ReactNode;
      children: React.ReactNode;
    }) => (
      <main>
        <h1>{title}</h1>
        {statusContent}
        {children}
      </main>
    ),
  }),
);

const location = {
  id: "location-1",
  hotel_id: "hotel-1",
  name: "Estoque central",
  internal_code: "CENTRAL",
  description: "Principal",
  display_order: 0,
  is_active: true,
  archived_at: null,
  position_count: 1,
  total_quantity: 2,
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:00:00.000Z",
};
const product = {
  id: "product-1",
  hotel_id: "hotel-1",
  name: "Água mineral",
  internal_code: "AGUA",
  description: null,
  kind: "physical",
  sales_unit: "unit",
  provider: { type: "hotel", partner: null },
  category: {
    id: "category-1",
    hotel_id: "hotel-1",
    name: "Frigobar",
    display_order: 0,
    is_active: true,
    archived_at: null,
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-01T10:00:00.000Z",
  },
  unit_price: 8,
  status: "active",
  archived_at: null,
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:00:00.000Z",
};
const position = {
  id: "position-1",
  hotel_id: "hotel-1",
  product,
  location,
  quantity: 2,
  version: 3,
  minimum_quantity: 4,
  ideal_quantity: 10,
  suggested_replenishment: 8,
  average_unit_cost: 2.5,
  inventory_value: 5,
  status: "low",
  is_active: true,
  archived_at: null,
  updated_at: "2026-09-01T10:00:00.000Z",
};
const allPermissions = Object.values(PERMISSIONS).filter((permission) =>
  permission.includes("inventory"),
);

beforeEach(() => {
  mocks.getUser.mockResolvedValue({ permissions: allPermissions });
  mocks.overview.mockResolvedValue({
    settings: {
      hotel_id: "hotel-1",
      negative_stock_policy: "allow_with_warning",
      updated_at: "2026-09-01T10:00:00.000Z",
    },
    items: [position],
  });
  mocks.locations.mockResolvedValue([location]);
  mocks.products.mockResolvedValue([product]);
  mocks.movements.mockResolvedValue({
    items: [
      {
        id: "movement-1",
        product_name: "Água mineral",
        location_name: "Estoque central",
        kind: "receipt",
        quantity_delta: 2,
        quantity_before: 0,
        quantity_after: 2,
        total_cost: 5,
        occurred_at: "2026-09-01T10:00:00.000Z",
      },
    ],
    next_cursor: null,
  });
  mocks.counts.mockResolvedValue([
    {
      id: "count-1",
      location,
      status: "draft",
      items: [
        {
          id: "count-item-1",
          product_name: "Água mineral",
          expected_quantity: 2,
          counted_quantity: null,
        },
      ],
    },
  ]);
  mocks.audit.mockResolvedValue({
    items: [
      {
        id: "audit-1",
        hotel_id: "hotel-1",
        entity_type: "position",
        entity_id: "position-1",
        action: "inventory.position.created",
        actor_id: "user-1",
        actor_name: "Gerente",
        changes: { initial_quantity: 2 },
        created_at: "2026-09-01T10:00:00.000Z",
      },
    ],
    next_cursor: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InventoryWorkspace", () => {
  it("renders alerts, costs and editable thresholds on the overview", async () => {
    render(await InventoryWorkspace({ tab: "overview", status: "updated" }));
    expect(screen.getByText("Água mineral")).toBeTruthy();
    expect(screen.getByText(/Custo médio R\$ 2,50/)).toBeTruthy();
    expect(screen.getByText(/abaixo do mínimo/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Salvar limites" })).toBeTruthy();
  });

  it("renders movement posting, transfer and the immutable ledger", async () => {
    render(await InventoryWorkspace({ tab: "movements" }));
    expect(screen.getByRole("button", { name: "Registrar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Transferir" })).toBeTruthy();
    expect(screen.getByText(/saldo 0 → 2/)).toBeTruthy();
    expect(screen.getByText("inventory.position.created")).toBeTruthy();
  });

  it("renders draft counts with save, complete and cancel actions", async () => {
    render(await InventoryWorkspace({ tab: "counts" }));
    expect(screen.getByRole("button", { name: "Abrir contagem" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Salvar contagem" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Concluir" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
  });

  it("renders policy, location and explicit product activation settings", async () => {
    mocks.overview.mockResolvedValueOnce({
      settings: {
        hotel_id: "hotel-1",
        negative_stock_policy: "block",
        updated_at: "2026-09-01T10:00:00.000Z",
      },
      items: [],
    });
    render(await InventoryWorkspace({ tab: "settings" }));
    expect(
      screen.getByRole("button", { name: "Salvar política" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Criar local" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Ativar controle" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Arquivar" })).toBeTruthy();
  });

  it("denies the module without inventory read permission", async () => {
    mocks.getUser.mockResolvedValueOnce({ permissions: [] });
    render(await InventoryWorkspace({ tab: "overview" }));
    expect(screen.getByText(/Sem permissão para consultar/)).toBeTruthy();
    expect(mocks.overview).not.toHaveBeenCalled();
  });
});
