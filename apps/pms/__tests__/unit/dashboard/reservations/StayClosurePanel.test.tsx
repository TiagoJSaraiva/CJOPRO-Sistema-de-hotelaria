// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StayClosurePanel } from "../../../../src/app/dashboard/reservations/_components/StayClosurePanel";

const preview = { cancel_penalty: 40, no_show_penalty: 100, balance: 50 };
const base = {
  stayStatus: "confirmed",
  reservationId: "reservation-1",
  canCancel: true,
  cancelBlockReason: null,
  canNoShow: true,
  noShowBlockReason: null,
  canSettle: true,
  cashSession: null,
  disabled: false,
  closure: preview,
  onClose: vi.fn(),
  onSettled: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  base.onClose.mockReset();
  base.onSettled.mockReset();
});

describe("StayClosurePanel", () => {
  it("mostra a multa e o que sobra antes de confirmar o cancelamento", () => {
    render(<StayClosurePanel {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const summary = screen.getByRole("group", {
      name: "Confirmar cancelamento",
    });
    expect(summary.textContent).toMatch(/Multa do plano.*40,00/);
    expect(summary.textContent).toMatch(/A devolver.*10,00/);
    expect(base.onClose).not.toHaveBeenCalled();
  });

  it("mostra a multa do no-show e o que falta receber", () => {
    render(<StayClosurePanel {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "No-show" }));
    const summary = screen.getByRole("group", { name: "Confirmar no-show" });
    expect(summary.textContent).toMatch(/Multa do plano.*100,00/);
    expect(summary.textContent).toMatch(/A receber.*50,00/);
  });

  it("não confirma sem motivo", () => {
    render(<StayClosurePanel {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const confirm = screen.getByRole("button", {
      name: "Confirmar cancelamento",
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "ab" },
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it("confirma com o motivo informado", () => {
    render(<StayClosurePanel {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Pedido do hóspede" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cancelamento" }),
    );
    expect(base.onClose).toHaveBeenCalledWith("cancel", "Pedido do hóspede");
  });

  it("voltar desiste sem encerrar", () => {
    render(<StayClosurePanel {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.queryByLabelText("Motivo")).toBeNull();
    expect(base.onClose).not.toHaveBeenCalled();
  });

  it("explica por que a ação está indisponível", () => {
    render(
      <StayClosurePanel
        {...base}
        canNoShow={false}
        noShowBlockReason="No-show disponível somente após o limite de check-in."
      />,
    );
    const button = screen.getByRole("button", {
      name: "No-show",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(
      screen.getByText("No-show disponível somente após o limite de check-in."),
    ).toBeTruthy();
  });

  const closed = {
    ...base,
    stayStatus: "canceled",
    canCancel: false,
    canNoShow: false,
  };

  it("oferece devolver o crédito da reserva encerrada", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, kind: "refund", balance: 0 }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<StayClosurePanel {...closed} />);
    expect(
      screen.getByRole("heading", { name: "Devolver crédito" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar devolução" }),
    );
    await waitFor(() => expect(base.onSettled).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(url).toBe("/api/reservation-operations/reservation-1/settlement");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ amount: 50, method: "pix" });
    expect(body.idempotency_key).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("oferece receber a multa quando o saldo é negativo", () => {
    render(
      <StayClosurePanel {...closed} closure={{ ...preview, balance: -40 }} />,
    );
    expect(screen.getByRole("heading", { name: "Receber multa" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Registrar recebimento" }),
    ).toBeTruthy();
  });

  it("mostra a recusa do acerto e mantém a mesma chave para repetir", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ message: "Falha ao registrar." }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<StayClosurePanel {...closed} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar devolução" }),
    );
    await screen.findByText("Falha ao registrar.");
    expect(base.onSettled).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar devolução" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const keys = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse((call as unknown as [string, { body: string }])[1].body)
          .idempotency_key,
    );
    expect(keys[0]).toBe(keys[1]);
    vi.unstubAllGlobals();
  });

  it("dinheiro fica indisponível sem sessão de caixa", () => {
    render(<StayClosurePanel {...closed} />);
    const cash = screen.getByRole("option", {
      name: "Dinheiro",
    }) as HTMLOptionElement;
    expect(cash.disabled).toBe(true);
  });

  it("dinheiro usa a sessão aberta de quem opera", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <StayClosurePanel
        {...closed}
        cashSession={{ id: "session-1", registerName: "Caixa 1" }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Meio de pagamento"), {
      target: { value: "cash" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar devolução" }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1]
        .body,
    );
    expect(body.cash_session_id).toBe("session-1");
    vi.unstubAllGlobals();
  });

  it("não oferece acerto sem saldo ou sem permissão", () => {
    const { rerender } = render(
      <StayClosurePanel {...closed} closure={{ ...preview, balance: 0 }} />,
    );
    expect(
      screen.queryByRole("heading", { name: "Devolver crédito" }),
    ).toBeNull();
    rerender(<StayClosurePanel {...closed} canSettle={false} />);
    expect(
      screen.queryByRole("heading", { name: "Devolver crédito" }),
    ).toBeNull();
    expect(screen.getByText(/Saldo a devolver/)).toBeTruthy();
  });
});
