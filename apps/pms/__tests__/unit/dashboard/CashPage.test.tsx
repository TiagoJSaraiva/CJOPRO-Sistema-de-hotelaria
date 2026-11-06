// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const mocks = vi.hoisted(() => ({ user: vi.fn(), request: vi.fn() }));
vi.mock("../../../src/lib/auth", () => ({ getUserFromSession: mocks.user }));
vi.mock("../../../src/lib/adminApi", () => ({
  requestOperationsFinanceEndpoint: mocks.request,
}));
vi.mock("../../../src/app/dashboard/cash/actions", () => ({
  approveDailyCloseAction: vi.fn(),
  countCashSessionAction: vi.fn(),
  createCashRegisterAction: vi.fn(),
  decideCashDifferenceAction: vi.fn(),
  openCashSessionAction: vi.fn(),
  postCashMovementAction: vi.fn(),
  prepareDailyCloseAction: vi.fn(),
}));

import CashPage from "../../../src/app/dashboard/cash/page";

const session = {
  id: "session",
  status: "open",
  version: 1,
  operator_name: "Caixa Aurora",
  opening_float: 100,
  expected_cash: null,
  counted_cash: null,
  difference_amount: null,
  movement_totals: { opening_float: 100, cash_in: 50, cash_out: 20 },
};

function daily(overrides: Record<string, unknown> = {}) {
  return {
    projection: {
      is_zero_activity: false,
      totals: { income: 0, expense: 0, refund: 0 },
      transactions: [],
      cash_sessions: [],
      blockers: [],
    },
    close: null,
    ...overrides,
  };
}

function backend(activeSession: unknown, dailyView: unknown = daily()) {
  mocks.request.mockImplementation(async (path: string) => {
    if (path === "cash-registers")
      return {
        operational_date: "2026-05-12",
        currency: "BRL",
        registers: [
          {
            id: "register",
            name: "Caixa da recepção",
            code: "REC-01",
            kind: "reception",
            currency: "BRL",
            difference_tolerance: 5,
            active_session: activeSession,
          },
        ],
      };
    if (path.startsWith("daily-close")) return dailyView;
    return { items: [] };
  });
}

async function renderPage(status?: string) {
  render(
    await CashPage({
      searchParams: Promise.resolve(status ? { status } : {}),
    }),
  );
}

beforeEach(() => {
  mocks.user.mockResolvedValue({
    permissions: [
      PERMISSIONS.CASH_MANAGEMENT_READ,
      PERMISSIONS.CASH_REGISTER_OPERATE,
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("caixa em português", () => {
  it("mostra a sessão e os movimentos sem códigos internos", async () => {
    backend(session);
    await renderPage();
    const card = screen.getByRole("article");
    expect(within(card).getByText("Sessão aberta")).toBeTruthy();
    expect(within(card).getByText(/Suprimento: R\$\s*50,00/)).toBeTruthy();
    expect(within(card).getByText(/Retirada: R\$\s*20,00/)).toBeTruthy();
    expect(card.textContent).not.toMatch(/cash in|cash out|opening float|open/);
  });

  it("não revela o valor esperado antes da contagem", async () => {
    backend(session);
    await renderPage();
    expect(
      screen.getByText(/valor esperado protegido até a contagem/),
    ).toBeTruthy();
    expect(screen.queryByText(/130,00/)).toBeNull();
  });

  it("mostra a situação do fechamento e da sessão do dia em português", async () => {
    backend(
      null,
      daily({
        close: { status: "prepared", version: 2, prepared_by_name: "Fin" },
        projection: {
          is_zero_activity: false,
          totals: { income: 0, expense: 0, refund: 0 },
          transactions: [],
          blockers: [],
          cash_sessions: [
            {
              id: "s",
              status: "difference_pending",
              expected_cash: 130,
              counted_cash: 120,
              difference_amount: -10,
            },
          ],
        },
      }),
    );
    await renderPage();
    expect(screen.getByText(/Estado: Preparado/)).toBeTruthy();
    const sessions = screen.getByTestId("daily-cash-sessions");
    expect(sessions.textContent).toContain("Com diferença pendente");
    expect(sessions.textContent).not.toContain("difference");
  });
});

describe("resultado da operação", () => {
  it("sucesso aparece como status", async () => {
    backend(null);
    await renderPage("prepared");
    expect(screen.getByRole("status").textContent).toContain(
      "Fechamento preparado",
    );
  });

  it("falha aparece como alerta e diz o motivo", async () => {
    backend(null);
    await renderPage("projection_changed");
    expect(screen.getByRole("alert").textContent).toContain(
      "Os dados do dia mudaram",
    );
    expect(screen.queryByText(/Status:/)).toBeNull();
  });

  it("código desconhecido na URL não vira mensagem de sucesso nem é ecoado", async () => {
    backend(null);
    await renderPage("codigo_inventado");
    expect(screen.getByRole("alert").textContent).toBe(
      "Não foi possível concluir a operação.",
    );
  });
});

describe("campos acessíveis", () => {
  it("o formulário de movimento identifica os três campos", async () => {
    backend(session);
    await renderPage();
    expect(screen.getByLabelText("Tipo de movimento")).toBeTruthy();
    expect(screen.getByLabelText("Valor do movimento")).toBeTruthy();
    expect(screen.getByLabelText("Motivo do movimento")).toBeTruthy();
  });
});
