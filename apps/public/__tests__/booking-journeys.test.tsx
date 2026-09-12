import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingJourney } from "../src/app/hotel/[slug]/booking-journey";
import { PrearrivalJourney } from "../src/app/pre-chegada/[token]/prearrival-journey";

const response = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  vi.stubGlobal("crypto", {
    randomUUID: () => "11111111-1111-4111-8111-111111111111",
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("public booking journeys", () => {
  it("quotes a category and creates a hold without exposing a room number", async () => {
    const fetch = vi
      .fn()
      .mockReturnValueOnce(
        response({
          hotel: { name: "Hotel Aurora", currency: "BRL" },
          configuration: { terms: "Termos diretos", consent_version: "v1" },
        }),
      )
      .mockReturnValueOnce(
        response({
          quote_id: "quote",
          fingerprint: "fingerprint",
          expires_at: "2026-10-01T12:00:00Z",
          currency: "BRL",
          items: [
            {
              id: "item",
              room_index: 1,
              room_type: "Standard",
              plan_name: "Flexível",
              rate_plan_version_id: "rate",
              available_count: 2,
              total: 400,
              nightly: [],
            },
          ],
        }),
      )
      .mockReturnValueOnce(
        response({
          reservation_code: "WEB-123",
          expires_at: "2026-10-01T13:00:00Z",
          access_token: "access",
        }),
      );
    vi.stubGlobal("fetch", fetch);
    render(<BookingJourney slug="hotel-aurora" />);
    expect(await screen.findByText("Hotel Aurora")).toBeTruthy();

    const dateInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="date"]'),
    );
    fireEvent.change(dateInputs[0]!, { target: { value: "2026-10-10" } });
    fireEvent.change(dateInputs[1]!, { target: { value: "2026-10-12" } });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Consultar categorias" })
        .closest("form")!,
    );
    expect(await screen.findByText("Standard")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio"));
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Maria Silva" },
    });
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "maria@example.com" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Criar pré-reserva" })
        .closest("form")!,
    );
    expect(await screen.findByText(/Pré-reserva WEB-123 criada/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("room_id");
  });

  it("preserves a generic error for unavailable hotels", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(response({}, false)));
    render(<BookingJourney slug="indisponivel" />);
    expect(await screen.findByText(/não está disponível/)).toBeTruthy();
  });

  it("submits prearrival and leaves changes pending staff review", async () => {
    const fetch = vi
      .fn()
      .mockReturnValueOnce(
        response({
          reservation: {
            reservation_code: "RES-1",
            version: 2,
            lifecycle_status: "confirmed",
          },
          accommodations: [
            {
              id: "a",
              room_type: "Standard",
              checkin_date: "2026-10-10",
              checkout_date: "2026-10-12",
            },
          ],
          requests: [],
        }),
      )
      .mockReturnValueOnce(response({ result: "ok" }))
      .mockReturnValueOnce(response({ result: "ok" }));
    vi.stubGlobal("fetch", fetch);
    render(<PrearrivalJourney token="opaque-token" />);
    expect(await screen.findByText("Reserva RES-1")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Maria" },
    });
    fireEvent.change(screen.getByLabelText("Tipo do documento"), {
      target: { value: "CPF" },
    });
    fireEvent.change(screen.getByLabelText("Número do documento"), {
      target: { value: "123" },
    });
    fireEvent.change(screen.getByLabelText("Nascimento"), {
      target: { value: "1990-01-01" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Salvar pré-chegada" })
        .closest("form")!,
    );
    expect(await screen.findByText(/Pré-chegada registrada/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("O que precisa mudar?"), {
      target: { value: "Chegar um dia depois" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Enviar para análise" })
        .closest("form")!,
    );
    expect(
      await screen.findByText(/reserva ainda não foi alterada/),
    ).toBeTruthy();
  });

  it("does not reveal whether an invalid access token belongs to a reservation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(response({}, false)));
    render(<PrearrivalJourney token="missing" />);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(
        /inválido, expirou ou foi substituído/,
      ),
    );
    expect(document.body.textContent).not.toContain("missing");
  });
});
