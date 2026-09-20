// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  request: vi.fn(),
}));

vi.mock("../../../src/lib/auth", () => ({
  getUserFromSession: mocks.user,
}));
vi.mock("../../../src/lib/adminApi", () => ({
  requestOperationsFinanceEndpoint: mocks.request,
}));
vi.mock("../../../src/app/dashboard/training/actions", () => ({
  actTrainingClockAction: vi.fn(),
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

import TrainingPage from "../../../src/app/dashboard/training/page";

beforeEach(() => {
  vi.stubEnv("LOCAL_TRAINING_ENABLED", "true");
  mocks.user.mockResolvedValue({
    permissions: [PERMISSIONS.TRAINING_ENVIRONMENT_MANAGE],
  });
  mocks.request.mockResolvedValue({
    hotel_id: "hotel-1",
    timezone: "America/Sao_Paulo",
    scenario_key: "cash-close",
    scenario_version: 1,
    clock_mode: "frozen",
    frozen_at: "2026-09-19T12:00:00.000Z",
    operational_now: "2026-09-19T12:00:00.000Z",
    real_now: "2026-09-20T12:00:00.000Z",
    version: 3,
    updated_by: "user-1",
    updated_at: "2026-09-20T12:00:00.000Z",
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it("shows the frozen operational clock separately from real time", async () => {
  render(await TrainingPage({ searchParams: Promise.resolve({}) }));

  expect(
    screen.getByRole("heading", { name: "Treinamento local" }),
  ).toBeTruthy();
  expect(screen.getByText(/cash-close · versão 1/)).toBeTruthy();
  expect(screen.getByText("Congelado")).toBeTruthy();
  expect(screen.getByText("America/Sao_Paulo")).toBeTruthy();
  expect(
    document.querySelector('input[name="local_at"][type="datetime-local"]'),
  ).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain(
    "controles de segurança continuam usando o tempo real",
  );
  expect(
    (screen.getByRole("button", { name: "Congelar" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: "Avançar" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(screen.getByText(/nunca é oferecida nesta página/)).toBeTruthy();
});

it("does not load the capability when the local guard is disabled", async () => {
  vi.stubEnv("LOCAL_TRAINING_ENABLED", "false");
  render(await TrainingPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByText(/somente no ambiente local/i)).toBeTruthy();
  expect(mocks.request).not.toHaveBeenCalled();
});
