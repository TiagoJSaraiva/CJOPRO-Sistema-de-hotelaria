// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  request: vi.fn(),
  customers: vi.fn(),
}));
vi.mock("../../../src/lib/auth", () => ({ getUserFromSession: mocks.user }));
vi.mock("../../../src/lib/adminApi", () => ({
  requestOperationsFinanceEndpoint: mocks.request,
  listCustomers: mocks.customers,
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

import AnalyticsPage from "../../../src/app/dashboard/reservations/analytics/page";
import ChannelsPage from "../../../src/app/dashboard/reservations/channels/page";
import PrearrivalPage from "../../../src/app/dashboard/reservations/prearrival/page";
import RatesPage from "../../../src/app/dashboard/reservations/rates/page";
import RelationshipPage from "../../../src/app/dashboard/customers/relationship/page";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.customers.mockResolvedValue([]);
});

it("renders the stage 6 reservation workspaces with authorized source data", async () => {
  mocks.user.mockResolvedValue({
    permissions: [
      PERMISSIONS.PREARRIVAL_MANAGE,
      PERMISSIONS.RATE_PLANS_MANAGE,
      PERMISSIONS.BOOKING_CHANNELS_MANAGE,
      PERMISSIONS.INTEGRATED_ANALYTICS_READ,
    ],
  });
  mocks.request.mockImplementation((path: string) => {
    if (path === "prearrival/board")
      return Promise.resolve({ requests: [], unassigned_arrivals: [{}] });
    if (path === "rate-plans") return Promise.resolve({ items: [] });
    if (path === "booking-channels") return Promise.resolve({ items: [] });
    if (path === "booking-configuration") return Promise.resolve({});
    if (path === "booking-channels/inbox")
      return Promise.resolve({ items: [] });
    return Promise.resolve({
      items: [
        {
          date: "2026-09-12",
          forecast: { confirmed_room_nights: 2, held_room_nights: 1 },
          actual: { occupied_room_nights: 1 },
          reconciled_at: "2026-09-12T12:00:00Z",
          closed_snapshot: false,
        },
      ],
    });
  });
  render(await PrearrivalPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText(/1 chegada/)).toBeTruthy();
  cleanup();
  render(await RatesPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText(/Novo plano/)).toBeTruthy();
  cleanup();
  render(await ChannelsPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("Venda direta")).toBeTruthy();
  cleanup();
  render(await AnalyticsPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText("Previsão")).toBeTruthy();
  expect(screen.getByText("Realizado")).toBeTruthy();
});

it("maps a channel with readable room and rate-plan references", async () => {
  mocks.user.mockResolvedValue({
    permissions: [PERMISSIONS.BOOKING_CHANNELS_MANAGE],
  });
  mocks.request.mockImplementation((path: string) => {
    if (path === "booking-channels")
      return Promise.resolve({
        items: [
          {
            id: "channel-1",
            name: "HospedaLink Sandbox",
            code: "HOSPEDALINK-AURORA",
            active: true,
            mappings: [],
          },
        ],
      });
    if (path === "booking-configuration") return Promise.resolve({});
    if (path === "booking-channels/inbox")
      return Promise.resolve({ items: [] });
    return Promise.resolve({
      room_types: [{ value: "Standard", label: "Standard", room_count: 12 }],
      rate_plans: [
        {
          id: "rate-1",
          code: "FLEX",
          name: "Tarifa flexível",
          version: 2,
          channels: ["channel"],
        },
      ],
    });
  });

  render(await ChannelsPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByText(/simulador fictício/i)).toBeTruthy();
  expect(
    screen.getByRole("option", { name: "Standard (12 quarto(s))" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("option", {
      name: "Tarifa flexível · FLEX · v2",
    }),
  ).toBeTruthy();
  expect(screen.getByDisplayValue(/HL-001,create,RES-001/)).toBeTruthy();
  expect(screen.getByText(/Nenhum evento aguardando decisão/)).toBeTruthy();
});

it("protects customer relationship and renders declared preferences", async () => {
  mocks.user.mockResolvedValue({ permissions: [] });
  render(await RelationshipPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByText(/Sem permissão/)).toBeTruthy();
  cleanup();

  mocks.user.mockResolvedValue({
    permissions: [
      PERMISSIONS.GUEST_RELATIONSHIP_READ,
      PERMISSIONS.GUEST_RELATIONSHIP_MANAGE,
    ],
  });
  mocks.customers.mockResolvedValue([{ id: "customer", full_name: "Maria" }]);
  mocks.request.mockResolvedValue({
    customer: { id: "customer", full_name: "Maria" },
    reservations: [],
    stays: [],
    preferences: [
      {
        id: "preference",
        category: "room",
        value: "Andar silencioso",
        source: "guest",
        consent_version: "v1",
      },
    ],
  });
  render(
    await RelationshipPage({
      searchParams: Promise.resolve({ customerId: "customer" }),
    }),
  );
  expect(screen.getByText(/Andar silencioso/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Registrar preferência" }),
  ).toBeTruthy();
});
