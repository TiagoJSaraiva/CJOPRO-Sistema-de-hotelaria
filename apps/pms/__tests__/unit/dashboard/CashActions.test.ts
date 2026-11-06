import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../../src/lib/adminApi", () => ({
  requestOperationsFinanceEndpoint: mocks.request,
}));

import {
  approveDailyCloseAction,
  decideCashDifferenceAction,
  postCashMovementAction,
  prepareDailyCloseAction,
} from "../../../src/app/dashboard/cash/actions";
import {
  cashMovementLabel,
  cashOutcome,
  cashSessionStatusLabel,
  dailyCloseStatusLabel,
} from "../../../src/app/dashboard/cash/cashLabels";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const backendError = (details?: string) =>
  Object.assign(new Error("O estado mudou"), { details });

beforeEach(() => {
  mocks.request.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("falhas das ações de caixa", () => {
  it("leva à tela o motivo devolvido pelo backend", async () => {
    mocks.request.mockRejectedValue(backendError("blocking_items"));
    await expect(
      prepareDailyCloseAction(form({ date: "2026-05-12", version: "0" })),
    ).rejects.toThrow("REDIRECT:/dashboard/cash?status=blocking_items");
  });

  it("falha sem motivo conhecido não se passa por sucesso", async () => {
    mocks.request.mockRejectedValue(backendError());
    await expect(
      postCashMovementAction(
        form({ id: "s", kind: "cash_in", amount: "1", reason: "abc" }),
      ),
    ).rejects.toThrow("REDIRECT:/dashboard/cash?status=failed");
    expect(cashOutcome("failed").tone).toBe("error");
  });
});

describe("resultado de sucesso", () => {
  it("movimento e decisão têm mensagens próprias", async () => {
    mocks.request.mockResolvedValue({});
    await expect(
      postCashMovementAction(
        form({ id: "s", kind: "cash_in", amount: "1", reason: "abc" }),
      ),
    ).rejects.toThrow("status=moved");
    await expect(
      decideCashDifferenceAction(
        form({
          id: "s",
          version: "1",
          action: "approve_difference",
          reason: "abc",
        }),
      ),
    ).rejects.toThrow("status=decided");
  });
});

describe("decisão sobre o fechamento", () => {
  const close = (action: string, reason = "") =>
    form({
      date: "2026-05-12",
      version: "2",
      fingerprint: "abc",
      action,
      reason,
    });

  it("aprovar sem observação usa o texto padrão e fecha o dia", async () => {
    mocks.request.mockResolvedValue({});
    await expect(approveDailyCloseAction(close("approve"))).rejects.toThrow(
      "status=closed",
    );
    expect(mocks.request.mock.calls[0]![2].reason).toBe(
      "Conferência diária aprovada.",
    );
  });

  it("devolver exige motivo e não grava o texto de aprovação", async () => {
    await expect(approveDailyCloseAction(close("reject"))).rejects.toThrow(
      "status=reason_required",
    );
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("devolver com motivo não anuncia dia fechado", async () => {
    mocks.request.mockResolvedValue({});
    await expect(
      approveDailyCloseAction(close("reject", "Sessão nova no dia")),
    ).rejects.toThrow("status=returned");
    expect(mocks.request.mock.calls[0]![2].reason).toBe("Sessão nova no dia");
  });
});

describe("rótulos", () => {
  it("todo estado conhecido tem texto em português", () => {
    expect(cashSessionStatusLabel("closed")).toBe("encerrada");
    expect(cashSessionStatusLabel("canceled")).toBe("cancelada");
    expect(dailyCloseStatusLabel("rejected")).toBe("Devolvido");
    expect(cashMovementLabel("deposit")).toBe("Depósito");
  });

  it("valor novo do banco não aparece cru na tela", () => {
    expect(cashSessionStatusLabel("novo_estado")).not.toContain("novo");
    expect(dailyCloseStatusLabel("novo_estado")).not.toContain("novo");
    expect(cashMovementLabel("novo_tipo")).not.toContain("novo");
  });

  it("nome herdado de Object não vira mensagem", () => {
    expect(cashOutcome("constructor").message).toBe(
      "Não foi possível concluir a operação.",
    );
  });
});
