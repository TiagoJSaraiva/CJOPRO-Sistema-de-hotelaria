// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  stays: vi.fn(),
  context: vi.fn(),
  clock: vi.fn(),
}));

vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: mocks.user,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  listConsumptionEligibleStays: mocks.stays,
  getConsumptionOperationalContext: mocks.context,
  getHotelClock: mocks.clock,
}));
vi.mock(
  "../../../../src/app/dashboard/consumption/_components/ConsumptionOrderComposer",
  () => ({
    ConsumptionOrderComposer: ({ timeZone }: { timeZone: string }) => (
      <p data-time-zone={timeZone}>Formulário de consumo</p>
    ),
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

import ConsumptionLaunchPage from "../../../../src/app/dashboard/consumption/launch/page";

beforeEach(() => {
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

const stay = {
  id: "stay-102",
  room_number: "102",
  primary_guest_name: "Bruno Exemplo",
};

async function renderPage(
  searchParams: { stay_id?: string; search?: string } = {},
) {
  mocks.user.mockResolvedValue({ permissions: ["post_consumption"] });
  render(
    await ConsumptionLaunchPage({
      searchParams: Promise.resolve(searchParams),
    }),
  );
}

it("reports a context failure without claiming there are no stays", async () => {
  mocks.stays.mockResolvedValue([stay]);
  mocks.context.mockRejectedValue(new Error("Context unavailable"));

  await renderPage({ search: "102" });

  expect(screen.getByRole("link", { name: /Quarto 102/ })).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("Tente novamente");
  expect(
    screen.queryByText("Nenhuma estadia em check-in foi encontrada."),
  ).toBeNull();
  expect(
    screen.getByRole("link", { name: "Tentar novamente" }).getAttribute("href"),
  ).toBe("/dashboard/consumption/launch?search=102");
});

it("opens the selected stay when its context is available", async () => {
  mocks.stays.mockResolvedValue([stay]);
  mocks.context.mockResolvedValue({ stay });

  await renderPage({ search: "102", stay_id: stay.id });

  expect(mocks.context).toHaveBeenCalledWith(stay.id);
  expect(screen.getByText("Formulário de consumo")).toBeTruthy();
});

it("distinguishes no search results from a failed search", async () => {
  mocks.stays.mockResolvedValue([]);
  await renderPage({ search: "103" });
  expect(screen.getByRole("status").textContent).toContain("Nenhuma estadia");
  cleanup();

  mocks.stays.mockRejectedValue(new Error("Backend unavailable"));
  await renderPage({ search: "102" });
  expect(screen.getByRole("alert").textContent).toContain(
    "Não foi possível carregar",
  );
});

it("reports a stale selected stay separately", async () => {
  mocks.stays.mockResolvedValue([stay]);
  mocks.context.mockRejectedValue(
    Object.assign(new Error("Conflict"), {
      statusCode: 409,
      details: "stay_not_checked_in",
    }),
  );

  await renderPage({ stay_id: stay.id });

  expect(screen.getByRole("alert").textContent).toContain(
    "não está mais disponível",
  );
});

it.each([
  ["occurred_before_checkin", "anterior ao check-in"],
  ["occurred_in_future", "no futuro"],
])("explains temporal conflict %s", async (details, message) => {
  mocks.stays.mockResolvedValue([stay]);
  mocks.context.mockRejectedValue(
    Object.assign(new Error("Conflict"), { statusCode: 409, details }),
  );
  await renderPage({ stay_id: stay.id });
  expect(screen.getByRole("alert").textContent).toContain(message);
});

it("hands the hotel zone to the composer", async () => {
  mocks.stays.mockResolvedValue([stay]);
  mocks.context.mockResolvedValue({ stay: { id: stay.id } });
  await renderPage();
  expect(
    screen.getByText("Formulário de consumo").getAttribute("data-time-zone"),
  ).toBe("Asia/Tokyo");
});

it("does not open the composer when the hotel clock is unavailable", async () => {
  mocks.stays.mockResolvedValue([stay]);
  mocks.context.mockResolvedValue({ stay: { id: stay.id } });
  mocks.clock.mockRejectedValue(new Error("Clock unavailable"));
  await renderPage();
  expect(screen.queryByText("Formulário de consumo")).toBeNull();
  expect(screen.getByRole("alert")).toBeTruthy();
});
