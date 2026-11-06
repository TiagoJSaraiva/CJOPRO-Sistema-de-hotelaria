import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type CashRegisterListView } from "@hotel/shared";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../../src/lib/adminApi", () => ({
  requestOperationsFinanceEndpoint: mocks.request,
}));

import {
  findOwnOpenCashSession,
  getOwnOpenCashSession,
} from "../../../src/lib/ownCashSession";

function register(active: { id: string; status: string; operator_id: string }) {
  return { id: "r", name: "Caixa da recepção", active_session: active };
}
const registers = (...items: unknown[]): CashRegisterListView["registers"] =>
  items as CashRegisterListView["registers"];

describe("findOwnOpenCashSession", () => {
  it("encontra a sessão aberta pela própria pessoa", () => {
    expect(
      findOwnOpenCashSession(
        registers(register({ id: "s", status: "open", operator_id: "me" })),
        "me",
      ),
    ).toEqual({ id: "s", registerName: "Caixa da recepção" });
  });

  it.each([
    ["de outra pessoa", { id: "s", status: "open", operator_id: "other" }],
    ["em contagem", { id: "s", status: "counting", operator_id: "me" }],
  ])("não aceita sessão %s", (_name, active) => {
    expect(
      findOwnOpenCashSession(registers(register(active)), "me"),
    ).toBeNull();
  });

  it("não aceita caixa sem sessão", () => {
    expect(
      findOwnOpenCashSession(
        registers({ id: "r", name: "Caixa", active_session: null }),
        "me",
      ),
    ).toBeNull();
  });
});

describe("getOwnOpenCashSession", () => {
  beforeEach(() => {
    mocks.request.mockReset();
  });

  it("não consulta o caixa sem a permissão", async () => {
    expect(
      await getOwnOpenCashSession({ id: "me", permissions: [] }),
    ).toBeNull();
    expect(await getOwnOpenCashSession(null)).toBeNull();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("devolve a sessão da pessoa", async () => {
    mocks.request.mockResolvedValue({
      registers: [register({ id: "s", status: "open", operator_id: "me" })],
    });
    expect(
      await getOwnOpenCashSession({
        id: "me",
        permissions: [PERMISSIONS.CASH_MANAGEMENT_READ],
      }),
    ).toEqual({ id: "s", registerName: "Caixa da recepção" });
  });

  it("uma falha na consulta não libera o dinheiro", async () => {
    mocks.request.mockRejectedValue(new Error("falhou"));
    expect(
      await getOwnOpenCashSession({
        id: "me",
        permissions: [PERMISSIONS.CASH_MANAGEMENT_READ],
      }),
    ).toBeNull();
  });
});
