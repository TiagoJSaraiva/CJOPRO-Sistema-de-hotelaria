// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ReservationArrivalPanel } from "../../../../src/app/dashboard/reservations/_components/ReservationArrivalPanel";

const arrival = {
  version: 1,
  guest_count: 2,
  accommodations: [
    {
      id: "a",
      room_type: "Standard",
      adults: 2,
      children: 0,
      checkin_date: "2026-10-03",
      checkout_date: "2026-10-05",
      nights: [{ date: "2026-10-03", amount: 250 }],
      guarantee_type: "first_night",
    },
  ],
  guarantee_required: 250,
  guarantee_received: 0,
  guests: [],
  submission: null,
};
const response = (data: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => data });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function show(
  manage = true,
  cashSession: { id: string; registerName: string } | null = null,
  onGuaranteeRegistered?: () => void,
) {
  return render(
    <ReservationArrivalPanel
      reservationId="r"
      canManageGuarantees={manage}
      canManagePrearrival={manage}
      publicSiteUrl="https://hotel.example"
      cashSession={cashSession}
      onGuaranteeRegistered={onGuaranteeRegistered}
    />,
  );
}
it("mostra ocupação e política sem oferecer ações não autorizadas", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => response({ arrival })),
  );
  show(false);
  expect(await screen.findByText(/Quantidade de hóspedes/)).toBeTruthy();
  expect(screen.getByText(/Primeira diária/)).toBeTruthy();
  expect(
    screen.queryByRole("button", {
      name: "Registrar adiantamento recebido",
    }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Gerar link de pré-chegada" }),
  ).toBeNull();
});
it("registra Pix com versão e chave, atualiza e impede duplo envio", async () => {
  const onGuaranteeRegistered = vi.fn();
  const fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
    response(
      init?.method === "POST"
        ? { ok: true }
        : {
            arrival: {
              ...arrival,
              guarantee_received: fetch.mock.calls.length > 2 ? 250 : 0,
            },
          },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  show(true, null, onGuaranteeRegistered);
  fireEvent.change(
    await screen.findByLabelText("Valor efetivamente recebido (R$)"),
    {
      target: { value: "250" },
    },
  );
  const form = screen
    .getByRole("button", { name: "Registrar adiantamento recebido" })
    .closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  await screen.findByText(/registrado como adiantamento/);
  const writes = fetch.mock.calls.filter((call) => call[1]?.method === "POST");
  expect(writes).toHaveLength(1);
  expect(JSON.parse(String(writes[0]![1]!.body))).toMatchObject({
    expected_version: 1,
    idempotency_key: expect.any(String),
    tenders: [{ method: "pix", amount: 250 }],
  });
  await waitFor(() => expect(onGuaranteeRegistered).toHaveBeenCalledOnce());
});
it("permite registrar dinheiro na sessão aberta da própria recepção", async () => {
  const fetch = vi.fn((_url: string, init?: RequestInit) =>
    response(init?.method === "POST" ? { ok: true } : { arrival }),
  );
  vi.stubGlobal("fetch", fetch);
  show(true, { id: "cash-session-1", registerName: "Recepção" });
  fireEvent.change(await screen.findByLabelText("Meio de pagamento recebido"), {
    target: { value: "cash" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Registrar adiantamento recebido" }),
  );
  await screen.findByText(/registrado como adiantamento/);
  const write = fetch.mock.calls.find((call) => call[1]?.method === "POST");
  expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({
    tenders: [
      {
        method: "cash",
        amount: 250,
        cash_session_id: "cash-session-1",
      },
    ],
  });
});
it("não permite dinheiro sem sessão de caixa aberta", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => response({ arrival })),
  );
  show();
  const select = (await screen.findByLabelText(
    "Meio de pagamento recebido",
  )) as HTMLSelectElement;
  const option = select.querySelector<HTMLOptionElement>(
    'option[value="cash"]',
  )!;
  expect(option.disabled).toBe(true);
});
it("usa cartão de crédito como meio recebido, sem mudar o contrato da API", async () => {
  const fetch = vi.fn((_url: string, init?: RequestInit) =>
    response(init?.method === "POST" ? { ok: true } : { arrival }),
  );
  vi.stubGlobal("fetch", fetch);
  show();
  fireEvent.change(await screen.findByLabelText("Meio de pagamento recebido"), {
    target: { value: "credit_card" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Registrar adiantamento recebido" }),
  );
  await screen.findByText(/registrado como adiantamento/);
  const write = fetch.mock.calls.find((call) => call[1]?.method === "POST");
  expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({
    tenders: [{ method: "credit_card", amount: 250 }],
  });
});
it("gera acesso usando o site configurado e permite consultar o envio", async () => {
  const fetch = vi.fn((_url: string, init?: RequestInit) =>
    response(
      init?.method === "POST"
        ? { token: "opaque" }
        : {
            arrival: {
              ...arrival,
              guests: [
                {
                  role: "companion",
                  full_name: "Bruno",
                  accommodation_id: "a",
                },
              ],
              submission: {
                version: 1,
                arrival_time: "14:00",
                submitted_at: "2026-10-03",
              },
            },
          },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  show();
  fireEvent.click(
    await screen.findByRole("button", { name: "Gerar link de pré-chegada" }),
  );
  expect(
    (
      await screen.findByRole("link", { name: "Abrir formulário público" })
    ).getAttribute("href"),
  ).toBe("https://hotel.example/pre-chegada/opaque");
  expect(screen.getByText("Acompanhante: Bruno")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Atualizar envio" }));
  await waitFor(() =>
    expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(4),
  );
});
it("anuncia conflito e recarrega o contexto sem perder os dados digitados", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) =>
      response(
        init?.method === "POST" ? { message: "Reserva mudou" } : { arrival },
        init?.method === "POST" ? 409 : 200,
      ),
    ),
  );
  show();
  fireEvent.change(
    await screen.findByLabelText("Valor efetivamente recebido (R$)"),
    {
      target: { value: "200" },
    },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Registrar adiantamento recebido" }),
  );
  await screen.findByText("Reserva mudou");
  expect(
    (
      screen.getByLabelText(
        "Valor efetivamente recebido (R$)",
      ) as HTMLInputElement
    ).value,
  ).toBe("200");
});
it("explica política legada e falha de consulta", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      response({
        arrival: {
          ...arrival,
          accommodations: [
            { ...arrival.accommodations[0], guarantee_type: null },
          ],
        },
      }),
    ),
  );
  show();
  expect(await screen.findByText(/Sem exigência definida/)).toBeTruthy();
  cleanup();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => response({ message: "Sem acesso" }, 403)),
  );
  show();
  expect(await screen.findByText("Sem acesso")).toBeTruthy();
});
