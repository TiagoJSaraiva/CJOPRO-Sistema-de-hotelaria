// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  getAccount: vi.fn(),
  getPayerAccounts: vi.fn(),
}));

vi.mock("../../../src/lib/auth", () => ({
  getUserFromSession: mocks.user,
}));
vi.mock("../../../src/lib/adminApi", () => ({
  getStayAccount: mocks.getAccount,
  getStayPayerAccounts: mocks.getPayerAccounts,
}));

import StayAccountPage from "../../../src/app/dashboard/reservations/account/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function error(statusCode: number) {
  return Object.assign(new Error("Falha na consulta"), { statusCode });
}

async function renderFailure(statusCode: number) {
  mocks.user.mockResolvedValue({
    permissions: ["access_reservations_calendar"],
  });
  mocks.getAccount.mockRejectedValue(error(statusCode));

  render(
    await StayAccountPage({
      searchParams: Promise.resolve({ stay_id: "stay-1" }),
    }),
  );
}

it("distingue conta inexistente e acesso negado no hotel ativo", async () => {
  await renderFailure(404);
  expect(screen.getByText("Conta não encontrada no hotel ativo.")).toBeTruthy();
  cleanup();

  await renderFailure(403);
  expect(
    screen.getByText("Sem permissão para consultar esta conta no hotel ativo."),
  ).toBeTruthy();
});

it("não mascara falha interna como conta inexistente", async () => {
  await renderFailure(500);
  expect(screen.getByRole("alert").textContent).toContain(
    "Não foi possível carregar a conta. Tente novamente.",
  );
  expect(
    screen.getByRole("link", { name: "Tentar novamente" }).getAttribute("href"),
  ).toBe("/dashboard/reservations/account?stay_id=stay-1");
  expect(screen.queryByText("Conta não encontrada no hotel ativo.")).toBeNull();
});
