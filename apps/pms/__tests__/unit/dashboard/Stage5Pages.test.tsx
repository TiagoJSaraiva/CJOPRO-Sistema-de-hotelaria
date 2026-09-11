// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  request: vi.fn(),
  products: vi.fn(),
  locations: vi.fn(),
}));
vi.mock("../../../src/lib/auth", () => ({ getUserFromSession: mocks.user }));
vi.mock("../../../src/lib/adminApi", () => ({
  requestOperationsFinanceEndpoint: mocks.request,
  listProducts: mocks.products,
  listInventoryLocations: mocks.locations,
}));
vi.mock(
  "../../../src/app/dashboard/_components/DashboardEntityPageShell",
  () => ({
    DashboardEntityPageShell: ({
      title,
      children,
    }: {
      title: string;
      children: React.ReactNode;
    }) => (
      <main>
        <h1>{title}</h1>
        {children}
      </main>
    ),
  }),
);
import ProcurementPage from "../../../src/app/dashboard/procurement/page";
import OrganizationsPage from "../../../src/app/dashboard/organizations/page";
import CashPage from "../../../src/app/dashboard/cash/page";
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.products.mockResolvedValue([]);
  mocks.locations.mockResolvedValue([]);
});

it("shows the procurement board only to authorized users", async () => {
  mocks.user.mockResolvedValue({ permissions: [] });
  render(await ProcurementPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText(/Sem permissão/)).toBeTruthy();
  cleanup();
  mocks.user.mockResolvedValue({
    permissions: [
      PERMISSIONS.PROCUREMENT_READ,
      PERMISSIONS.PROCUREMENT_APPROVE,
    ],
  });
  mocks.request.mockResolvedValue({
    policy: { configuration_required: true, currency: "BRL" },
    replenishments: [],
    orders: [],
    invoices: [],
    suppliers: [],
  });
  render(await ProcurementPage({ searchParams: Promise.resolve({}) }));
  expect(
    screen.getByRole("heading", { name: "Compras e reposição" }),
  ).toBeTruthy();
  expect(screen.getByText(/Configure antes/)).toBeTruthy();
});

it("renders centralized organization roles", async () => {
  mocks.user.mockResolvedValue({
    permissions: [PERMISSIONS.BUSINESS_ORGANIZATIONS_READ],
  });
  mocks.request.mockResolvedValue([
    {
      id: "org",
      legal_name: "Fornecedor Hotel",
      trade_name: "Fornecedor",
      tax_id: "123",
      currency: "BRL",
      active: true,
      roles: { stock_supplier_id: "supplier" },
    },
  ]);
  render(await OrganizationsPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("Fornecedor")).toBeTruthy();
  expect(screen.getByText(/stock_supplier_id/)).toBeTruthy();
});

it("renders the authorized organization overview and its review actions", async () => {
  mocks.user.mockResolvedValue({
    permissions: [
      PERMISSIONS.BUSINESS_ORGANIZATIONS_READ,
      PERMISSIONS.BUSINESS_ORGANIZATIONS_MANAGE,
    ],
  });
  const organizations = [
    {
      id: "org",
      legal_name: "Fornecedor Hotel",
      trade_name: null,
      tax_id: null,
      currency: "BRL",
      active: true,
      version: 2,
      roles: { stock_supplier_id: "supplier" },
    },
    {
      id: "target",
      legal_name: "Cadastro destino",
      trade_name: "Destino",
      tax_id: "456",
      currency: "BRL",
      active: true,
      version: 1,
      roles: {},
    },
  ];
  mocks.request.mockImplementation((path: string) =>
    path.endsWith("/overview")
      ? Promise.resolve({
          ...organizations[0],
          conflicts: [
            {
              id: "conflict",
              role_type: "stock_supplier",
              divergent_values: { trade_name: "Nome anterior" },
            },
          ],
          commercial_agreements: [],
          partner_settlements: null,
          maintenance_contracts: [],
          purchase_orders: [{}],
          corporate_authorizations: undefined,
        })
      : Promise.resolve(organizations),
  );
  render(
    await OrganizationsPage({
      searchParams: Promise.resolve({ id: "org" }),
    }),
  );
  expect(screen.getByText("Nova organização")).toBeTruthy();
  expect(screen.getByText("Divergências cadastrais")).toBeTruthy();
  expect(screen.getByText("Marcar revisada")).toBeTruthy();
  expect(screen.getByText("Consolidar cadastro")).toBeTruthy();
  expect(screen.getByText("Separar um papel")).toBeTruthy();
});

it("keeps expected cash hidden before the blind count", async () => {
  mocks.user.mockResolvedValue({
    permissions: [
      PERMISSIONS.CASH_MANAGEMENT_READ,
      PERMISSIONS.CASH_REGISTER_OPERATE,
    ],
  });
  mocks.request.mockImplementation((path: string) =>
    path === "cash-registers"
      ? Promise.resolve({
          registers: [
            {
              id: "register",
              name: "Recepção",
              code: "REC",
              currency: "BRL",
              difference_tolerance: 5,
              active_session: {
                id: "session",
                status: "open",
                version: 1,
                operator_id: "user",
                expected_cash: 999,
                difference_amount: null,
              },
            },
          ],
        })
      : Promise.resolve({
          close: null,
          projection: { transactions: [], cash_sessions: [], blockers: [] },
        }),
  );
  render(
    await CashPage({ searchParams: Promise.resolve({ date: "2026-09-11" }) }),
  );
  expect(screen.getByText("Valor contado")).toBeTruthy();
  expect(screen.queryByText(/999/)).toBeNull();
});
