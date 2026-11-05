// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  getAccount: vi.fn(),
  getPayerAccounts: vi.fn(),
  getHotelClock: vi.fn(),
}));

vi.mock("../../../src/lib/auth", () => ({
  getUserFromSession: mocks.user,
}));
vi.mock("../../../src/lib/adminApi", () => ({
  getStayAccount: mocks.getAccount,
  getStayPayerAccounts: mocks.getPayerAccounts,
  getHotelClock: mocks.getHotelClock,
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

function entry(
  id: string,
  kind: string,
  direction: "debit" | "credit",
  posted_at = "2026-05-12T15:30:00.000Z",
) {
  return {
    id,
    kind,
    direction,
    posted_at,
    amount: 100,
    open_amount: 0,
    currency: "BRL",
    description: `Descrição ${id}`,
  };
}

async function renderAccount(
  account: Record<string, unknown> = {},
  status?: string,
) {
  mocks.user.mockResolvedValue({
    permissions: ["access_reservations_calendar"],
  });
  mocks.getPayerAccounts.mockResolvedValue(null);
  mocks.getHotelClock.mockResolvedValue({
    timezone: "Asia/Tokyo",
    operational_date: "2026-05-12",
    operational_now: "2026-05-12T15:30:00.000Z",
  });
  mocks.getAccount.mockResolvedValue({
    stay_id: "stay-1",
    stay_status: "checked_out",
    status: "open",
    room_number: "102",
    reservation_code: "LOCAL-AUR-002",
    guest_name: "Hóspede",
    currency: "BRL",
    folio: {
      lodging_total: 100,
      consumption_total: 100,
      checkout_balance: 0,
      entries: [
        entry("1", "lodging", "debit"),
        entry("2", "consumption_charge", "debit"),
        entry("3", "payment", "credit"),
      ],
    },
    consumption_orders: [
      {
        id: "order-1",
        point_name: "Balcão",
        net_amount: 16,
        effective_net_amount: 16,
        effective_status: "active",
        billing_mode: "stay_folio",
        disposition: "charged",
        items: [],
      },
      {
        id: "order-2",
        point_name: null,
        net_amount: 16,
        effective_status: "legacy",
        billing_mode: null,
        disposition: "legacy_unclassified",
        items: [],
      },
    ],
    corrections: [],
    refunds: [],
    payment_batches: [
      { id: "batch-1", amount: 400, currency: "BRL", tenders: [] },
      {
        id: "batch-2",
        amount: 50,
        currency: "BRL",
        tenders: [{ id: "tender-1", payment_method: "pix" }],
      },
    ],
    checkout_record: null,
    ...account,
  });
  render(
    await StayAccountPage({
      searchParams: Promise.resolve({ stay_id: "stay-1", status }),
    }),
  );
}

it("mostra a conta em português, sem códigos internos", async () => {
  await renderAccount();
  const ledger = screen.getByRole("region", { name: "Lançamentos da conta" });
  for (const label of ["Hospedagem", "Consumo", "Pagamento"]) {
    expect(ledger.textContent).toContain(label);
  }
  const text = document.body.textContent || "";
  for (const code of [
    "lodging",
    "consumption_charge",
    "payment",
    "stay_folio",
    "legacy",
    "active",
    "pix",
  ]) {
    expect(text).not.toContain(code);
  }
  expect(text).toContain("Em aberto");
  expect(text).toContain("Lançamento no fólio");
  expect(text).toContain("Migrado sem forma de cobrança");
  expect(text).toContain("PIX");
});

it("não deixa separador sobrando em pagamento sem meio informado", async () => {
  await renderAccount();
  expect(screen.getByText(/R\$\s*400,00/).textContent?.trim()).toMatch(
    /400,00$/,
  );
});

it("mostra o horário do lançamento no fuso do hotel", async () => {
  await renderAccount();
  const ledger = screen.getByRole("region", { name: "Lançamentos da conta" });
  // 15h30 UTC são 00h30 do dia seguinte em Tóquio, em qualquer máquina.
  expect(ledger.textContent).toContain("13/05/2026, 00:30:00");
});

it("explica a situação da ação e não apresenta erro como sucesso", async () => {
  await renderAccount({}, "refunded");
  expect(screen.getByRole("status").textContent).toBe("Reembolso registrado.");
  expect(screen.getByRole("status").className).toContain("pms-alert-success");
  cleanup();

  await renderAccount({}, "forbidden");
  const denied = screen
    .getAllByRole("alert")
    .find((item) => item.textContent?.includes("Sem permissão"));
  expect(denied?.textContent).toBe("Sem permissão para esta ação.");
  expect(screen.queryByText(/forbidden/)).toBeNull();
  cleanup();

  await renderAccount({}, "valor-desconhecido");
  expect(screen.queryByText(/valor-desconhecido/)).toBeNull();
});
