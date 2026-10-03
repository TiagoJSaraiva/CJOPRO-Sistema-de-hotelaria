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
function show(manage = true) {
  return render(
    <ReservationArrivalPanel
      reservationId="r"
      canManageGuarantees={manage}
      canManagePrearrival={manage}
      publicSiteUrl="https://hotel.example"
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
  expect(screen.getByText(/primeira diária/)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Registrar sinal via PIX" }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Gerar link de pré-chegada" }),
  ).toBeNull();
});
it("registra PIX com versão e chave, atualiza e impede duplo envio", async () => {
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
  show();
  fireEvent.change(await screen.findByLabelText("Sinal via PIX (R$)"), {
    target: { value: "250" },
  });
  const form = screen
    .getByRole("button", { name: "Registrar sinal via PIX" })
    .closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  await screen.findByText(/Sinal via PIX registrado/);
  const writes = fetch.mock.calls.filter((call) => call[1]?.method === "POST");
  expect(writes).toHaveLength(1);
  expect(JSON.parse(String(writes[0]![1]!.body))).toMatchObject({
    expected_version: 1,
    idempotency_key: expect.any(String),
    tenders: [{ method: "pix", amount: 250 }],
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
      await screen.findByRole("link", { name: "Abrir pré-chegada" })
    ).getAttribute("href"),
  ).toBe("https://hotel.example/pre-chegada/opaque");
  expect(screen.getByText("Acompanhante: Bruno")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Atualizar dados da pré-chegada" }),
  );
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
  fireEvent.change(await screen.findByLabelText("Sinal via PIX (R$)"), {
    target: { value: "250" },
  });
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Registrar sinal via PIX" })
      .closest("form")!,
  );
  await screen.findByText("Reserva mudou");
  expect(
    (screen.getByLabelText("Sinal via PIX (R$)") as HTMLInputElement).value,
  ).toBe("250");
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
  expect(await screen.findByText(/sem exigência definida/)).toBeTruthy();
  cleanup();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => response({ message: "Sem acesso" }, 403)),
  );
  show();
  expect(await screen.findByText("Sem acesso")).toBeTruthy();
});
