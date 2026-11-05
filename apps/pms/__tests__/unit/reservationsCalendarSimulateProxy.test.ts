import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/adminApi", () => ({
  simulateReservationsCalendarBooking: vi.fn(),
}));

import { simulateReservationsCalendarBooking } from "../../src/lib/adminApi";
import { POST } from "../../src/app/api/reservations-calendar/simulate/route";

function request() {
  return new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify({ selected_cells: [] }),
  });
}

describe("proxy de simulação do calendário", () => {
  beforeEach(() => {
    vi.mocked(simulateReservationsCalendarBooking).mockReset();
  });

  it("devolve o resultado da simulação", async () => {
    vi.mocked(simulateReservationsCalendarBooking).mockResolvedValue({
      total: 100,
    } as never);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ total: 100 });
  });

  it.each([
    [409, "Quarto bloqueado."],
    [403, "Sem acesso."],
    [500, "Falha interna."],
  ])(
    "preserva o status %i do backend (QA-003)",
    async (statusCode, message) => {
      vi.mocked(simulateReservationsCalendarBooking).mockRejectedValue(
        Object.assign(new Error(message), {
          statusCode,
          details: "detalhe",
        }),
      );

      const response = await POST(request());

      expect(response.status).toBe(statusCode);
      expect(await response.json()).toEqual({ message, details: "detalhe" });
    },
  );

  it("usa 400 quando a falha não informa um status", async () => {
    vi.mocked(simulateReservationsCalendarBooking).mockRejectedValue(
      new Error("Corpo inválido."),
    );

    expect((await POST(request())).status).toBe(400);
  });
});
