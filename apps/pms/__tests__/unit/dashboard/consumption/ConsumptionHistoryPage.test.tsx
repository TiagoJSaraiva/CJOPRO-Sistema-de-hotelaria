// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  points: vi.fn(),
  locations: vi.fn(),
  clock: vi.fn(),
}));

vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: mocks.user,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  getConsumptionOrder: mocks.get,
  listConsumptionOrders: mocks.list,
  listConsumptionPoints: mocks.points,
  listInventoryLocations: mocks.locations,
  listConsumptionEligibleStays: vi.fn().mockResolvedValue([]),
  getConsumptionOperationalContext: vi.fn().mockResolvedValue(null),
  getStayPayerAccounts: vi.fn().mockResolvedValue(null),
  getHotelClock: mocks.clock,
}));
vi.mock("../../../../src/app/dashboard/consumption/accountActions", () => ({
  requestConsumptionCorrectionAction: vi.fn(),
}));
vi.mock("../../../../src/app/dashboard/consumption/transferActions", () => ({
  transferConsumptionAction: vi.fn(),
}));

import ConsumptionHistoryPage from "../../../../src/app/dashboard/consumption/history/page";

const order = {
  id: "c2000000-0000-4000-8000-000000000001",
  stay_id: "91000000-0000-4000-8000-000000000002",
  room_number: "102",
  reservation_code: "AUR-2",
  point_id: "a1000000-0000-4000-8000-000000000001",
  point_name: "Balcão",
  disposition: "charged",
  billing_mode: "stay_folio",
  provider_type: "hotel",
  is_legacy: false,
  net_amount: 16,
  effective_net_amount: 16,
  effective_status: "refund_pending",
  currency: "BRL",
  operator_name: "Operador",
  occurred_at: "2026-05-12T15:30:00.000Z",
  posted_at: "2026-05-12T16:30:00.000Z",
  items: [],
};

function clockIn(timezone: string) {
  mocks.clock.mockResolvedValue({
    timezone,
    operational_date: "2026-05-12",
    operational_now: "2026-05-12T18:00:00.000Z",
  });
}

async function renderPage(params: Record<string, string> = {}) {
  render(
    await ConsumptionHistoryPage({ searchParams: Promise.resolve(params) }),
  );
}

beforeEach(() => {
  mocks.user.mockResolvedValue({ permissions: ["read_consumption"] });
  mocks.list.mockResolvedValue({ items: [order], next_cursor: null });
  mocks.get.mockResolvedValue(null);
  mocks.points.mockResolvedValue([]);
  mocks.locations.mockResolvedValue([]);
  clockIn("America/Sao_Paulo");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("sem permissão, o histórico não é consultado", async () => {
  mocks.user.mockResolvedValue({ permissions: [] });
  await renderPage();
  expect(
    screen.getByText("Sem permissão para consultar comandas."),
  ).toBeTruthy();
  expect(mocks.list).not.toHaveBeenCalled();
});

it("o período é lido na hora do hotel e enviado como instante", async () => {
  await renderPage({ from: "2026-05-12T10:00", to: "2026-05-12T18:00" });
  expect(mocks.list).toHaveBeenCalledWith(
    expect.objectContaining({
      from: "2026-05-12T13:00:00.000Z",
      to: "2026-05-12T21:00:00.000Z",
    }),
  );
  // O campo continua mostrando o que a pessoa digitou.
  expect(screen.getByLabelText<HTMLInputElement>("De").value).toBe(
    "2026-05-12T10:00",
  );
  expect(screen.getByLabelText<HTMLInputElement>("Até").value).toBe(
    "2026-05-12T18:00",
  );
});

it("período inexistente é avisado e não vira outra data", async () => {
  await renderPage({ from: "2026-02-31T10:00" });
  expect(mocks.list).toHaveBeenCalledWith(
    expect.objectContaining({ from: undefined }),
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "Confira o período informado",
  );
});

it("falha do backend não se passa por histórico vazio", async () => {
  mocks.list.mockRejectedValue(new Error("Falha"));
  await renderPage();
  expect(screen.getByRole("alert").textContent).toContain(
    "Não foi possível carregar o histórico",
  );
  expect(screen.queryByText("Nenhuma comanda encontrada.")).toBeNull();
});

it("sem o relógio do hotel, não mostra datas em outro fuso", async () => {
  mocks.clock.mockRejectedValue(new Error("Falha"));
  await renderPage();
  expect(screen.getByRole("alert").textContent).toContain(
    "Não foi possível carregar o histórico",
  );
  expect(mocks.list).not.toHaveBeenCalled();
});

it("histórico realmente vazio continua dizendo que não há comandas", async () => {
  mocks.list.mockResolvedValue({ items: [], next_cursor: null });
  await renderPage();
  expect(screen.getByText("Nenhuma comanda encontrada.")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("falha ao abrir a ficha é avisada, sem esconder a lista", async () => {
  mocks.get.mockRejectedValue(new Error("Falha"));
  await renderPage({ id: order.id });
  expect(screen.getByRole("alert").textContent).toContain(
    "Não foi possível abrir esta comanda",
  );
  expect(screen.getByText("Ver recibo")).toBeTruthy();
});

it("datas aparecem no fuso do hotel, não no de quem renderiza", async () => {
  clockIn("Asia/Tokyo");
  mocks.get.mockResolvedValue(order);
  await renderPage({ id: order.id });
  expect(document.body.textContent).toContain("13/05/2026, 00:30:00");
  expect(document.body.textContent).toContain("Lançado 13/05/2026, 01:30:00");
});

it("a situação da comanda aparece em português, sem código interno", async () => {
  mocks.get.mockResolvedValue(order);
  await renderPage({ id: order.id });
  expect(screen.getByText("Reembolso pendente")).toBeTruthy();
  expect(document.body.textContent).not.toContain("refund_pending");
});

it("comanda sem situação registrada aparece como ativa", async () => {
  mocks.get.mockResolvedValue({ ...order, effective_status: null });
  await renderPage({ id: order.id });
  const label = screen.getByText("Situação efetiva");
  expect(label.nextElementSibling?.textContent).toBe("Ativa");
});

it("navegar pela lista preserva os filtros", async () => {
  mocks.list.mockResolvedValue({
    items: [order],
    next_cursor: "2026-05-12T10:00:00.000Z",
  });
  mocks.get.mockResolvedValue(order);
  await renderPage({
    from: "2026-05-12T10:00",
    disposition: "charged",
    id: order.id,
    cursor: "2026-05-12T12:00:00.000Z",
  });

  const next = new URL(
    screen.getByRole("link", { name: "Próxima página" }).getAttribute("href")!,
    "http://pms.test",
  ).searchParams;
  expect(next.get("from")).toBe("2026-05-12T10:00");
  expect(next.get("disposition")).toBe("charged");
  expect(next.get("cursor")).toBe("2026-05-12T10:00:00.000Z");
  expect(next.get("id")).toBeNull();

  const receipt = new URL(
    screen.getByRole("link", { name: "Ver recibo" }).getAttribute("href")!,
    "http://pms.test",
  ).searchParams;
  expect(receipt.get("from")).toBe("2026-05-12T10:00");
  expect(receipt.get("id")).toBe(order.id);

  const close = new URL(
    screen.getByRole("link", { name: "Fechar ficha" }).getAttribute("href")!,
    "http://pms.test",
  ).searchParams;
  expect(close.get("from")).toBe("2026-05-12T10:00");
  expect(close.get("id")).toBeNull();
});
