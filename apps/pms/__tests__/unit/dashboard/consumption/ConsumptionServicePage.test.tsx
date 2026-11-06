// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  board: vi.fn(),
  stays: vi.fn(),
  context: vi.fn(),
  clock: vi.fn(),
}));

vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: mocks.user,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  getConsumptionServiceBoard: mocks.board,
  listConsumptionEligibleStays: mocks.stays,
  getConsumptionOperationalContext: mocks.context,
  getHotelClock: mocks.clock,
}));
vi.mock(
  "../../../../src/app/dashboard/consumption/service/ConsumptionServiceWorkspace",
  () => ({
    ConsumptionServiceWorkspace: ({
      stays,
      timeZone,
    }: {
      stays: unknown[];
      timeZone: string;
    }) => <p data-time-zone={timeZone}>Estadias disponíveis: {stays.length}</p>,
  }),
);
vi.mock(
  "../../../../src/app/dashboard/_components/DashboardEntityPageShell",
  () => ({
    DashboardEntityPageShell: ({ children }: { children: ReactNode }) => (
      <main>{children}</main>
    ),
  }),
);

import ConsumptionServicePage from "../../../../src/app/dashboard/consumption/service/page";

beforeEach(() => {
  mocks.user.mockResolvedValue({ permissions: ["read_consumption"] });
  mocks.board.mockResolvedValue({ items: [], summary: {}, updated_at: "" });
  mocks.clock.mockResolvedValue({
    timezone: "Asia/Tokyo",
    operational_date: "2026-09-04",
    operational_now: "2026-09-04T15:00:00.000Z",
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderPage() {
  render(await ConsumptionServicePage({ searchParams: Promise.resolve({}) }));
}

it("shows the orders to a reader who cannot search stays to post", async () => {
  mocks.stays.mockRejectedValue(
    Object.assign(new Error("Sem permissão"), { statusCode: 403 }),
  );

  await renderPage();

  expect(screen.getByText("Estadias disponíveis: 0")).toBeTruthy();
  expect(mocks.context).not.toHaveBeenCalled();
});

it("does not hide other failures of the stay search", async () => {
  mocks.stays.mockRejectedValue(
    Object.assign(new Error("Falha"), { statusCode: 500 }),
  );

  await expect(renderPage()).rejects.toThrow("Falha");
});

it("denies access to anyone who cannot read or manage orders", async () => {
  mocks.user.mockResolvedValue({ permissions: [] });

  await renderPage();

  expect(screen.getByText(/Sem permissão para consultar pedidos/)).toBeTruthy();
  expect(mocks.board).not.toHaveBeenCalled();
});

it("hands the hotel zone to the workspace", async () => {
  mocks.stays.mockResolvedValue([]);
  await renderPage();
  expect(
    screen.getByText(/Estadias disponíveis/).getAttribute("data-time-zone"),
  ).toBe("Asia/Tokyo");
});
