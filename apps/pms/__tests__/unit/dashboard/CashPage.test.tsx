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
  adoptCashTransactionAction: vi.fn(),
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

// QA-091: quem aprova o fechamento vê o que entrou de um dia já fechado.
describe("lançamentos tardios no fechamento", () => {
  it("lista o lançamento com a data e o fechamento originais", async () => {
    backend(
      null,
      daily({
        late_postings: [
          {
            id: "late-1",
            type: "INCOME",
            category: "STAY_PAYMENT",
            description: "Pagamento recebido depois",
            amount: 70,
            payment_method: "pix",
            original_business_date: "2026-05-11",
            origin_close_business_date: "2026-05-11",
          },
        ],
      }),
    );
    await renderPage();
    const list = screen.getByRole("list", { name: "Lançamentos tardios" });
    expect(list.textContent).toContain("Pagamento recebido depois");
    expect(list.textContent).toContain("Pix");
    expect(list.textContent).toMatch(/R\$\s70,00/);
    expect(list.textContent).toContain("data original 11/05/2026");
    expect(list.textContent).toContain("fechamento de 11/05/2026");
  });

  it("sem lançamento tardio, não mostra a lista", async () => {
    backend(null);
    await renderPage();
    expect(
      screen.queryByRole("list", { name: "Lançamentos tardios" }),
    ).toBeNull();
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

  describe("dinheiro sem sessão no fechamento", () => {
    const blocked = daily({
      projection: {
        is_zero_activity: false,
        totals: { income: 5, expense: 0, refund: 0 },
        transactions: [],
        cash_sessions: [],
        blockers: [
          {
            kind: "cash_without_session",
            entity_id: "tx-1",
            title: "Dinheiro recebido sem sessão de caixa.",
            amount: 5,
          },
        ],
      },
    });
    const own = { ...session, operator_id: "cashier-1" };

    function asUser(id: string, permissions: string[]) {
      mocks.user.mockResolvedValue({ id, permissions, roles: [] });
    }

    it("quem tem sessão aberta assume o valor, com justificativa", async () => {
      asUser("cashier-1", [
        PERMISSIONS.CASH_MANAGEMENT_READ,
        PERMISSIONS.CASH_REGISTER_OPERATE,
      ]);
      backend(own, blocked);
      await renderPage();
      expect(screen.getByText(/Valor: R\$\s*5,00/)).toBeTruthy();
      const button = screen.getByRole<HTMLButtonElement>("button", {
        name: "Assumir na minha sessão",
      });
      const form = button.closest("form")!;
      expect(
        form.querySelector<HTMLInputElement>('input[name="record_id"]')!.value,
      ).toBe("tx-1");
      expect(
        form.querySelector<HTMLInputElement>('input[name="reason"]')!.required,
      ).toBe(true);
    });

    it("sem sessão própria, explica o que fazer", async () => {
      asUser("cashier-2", [
        PERMISSIONS.CASH_MANAGEMENT_READ,
        PERMISSIONS.CASH_REGISTER_OPERATE,
      ]);
      backend(own, blocked);
      await renderPage();
      expect(
        screen.queryByRole("button", { name: "Assumir na minha sessão" }),
      ).toBeNull();
      expect(screen.getByText(/abre a própria sessão/)).toBeTruthy();
    });

    it("quem não opera caixa só vê o impedimento", async () => {
      asUser("finance-1", [
        PERMISSIONS.CASH_MANAGEMENT_READ,
        PERMISSIONS.DAILY_CLOSE_PREPARE,
      ]);
      backend(null, blocked);
      await renderPage();
      expect(
        screen.getByText(/Dinheiro recebido sem sessão de caixa/),
      ).toBeTruthy();
      expect(
        screen.queryByRole("button", { name: "Assumir na minha sessão" }),
      ).toBeNull();
      expect(screen.queryByText(/abre a própria sessão/)).toBeNull();
    });
  });

  describe("abrir a sessão seguinte", () => {
    function registerWith(lastCounted: number | null) {
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
                active_session: null,
                last_counted_cash: lastCounted,
              },
            ],
          };
        if (path.startsWith("daily-close")) return daily();
        return { items: [] };
      });
    }

    it("parte da última contagem e pede justificativa para outro valor", async () => {
      registerWith(150);
      await renderPage();
      expect(screen.getByText(/Última contagem:\s*R\$\s*150,00/)).toBeTruthy();
      expect(
        screen.getByLabelText<HTMLInputElement>("Fundo inicial").value,
      ).toBe("150");
      expect(
        screen.getByLabelText("Justificativa, se o valor mudar"),
      ).toBeTruthy();
    });

    it("na primeira sessão, não há contagem nem justificativa", async () => {
      registerWith(null);
      await renderPage();
      expect(screen.queryByText(/Última contagem/)).toBeNull();
      expect(
        screen.getByLabelText<HTMLInputElement>("Fundo inicial").value,
      ).toBe("");
      expect(
        screen.queryByLabelText("Justificativa, se o valor mudar"),
      ).toBeNull();
    });
  });
});
