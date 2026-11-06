import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../../src/common/supabaseServer", () => ({
  createServerClient: () => ({ from: mocks.from }),
}));

import { createFinancialTransactionsRepository } from "../../src/repositories/financialTransactionsRepository";

/** Encadeia os filtros do cliente e devolve a próxima resposta programada. */
function query(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "update", "order", "limit"])
    chain[method] = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);
  return chain;
}

const refusal = { message: "cash_session_required", code: "P0001" };

describe("concluir uma transação em dinheiro", () => {
  beforeEach(() => {
    mocks.from.mockReset();
  });

  it("coloca o valor na sessão aberta de quem conclui", async () => {
    const retry = query({ data: { id: "tx" }, error: null });
    mocks.from
      .mockReturnValueOnce(query({ data: null, error: refusal }))
      .mockReturnValueOnce(query({ data: { id: "session" }, error: null }))
      .mockReturnValueOnce(retry);
    const result =
      await createFinancialTransactionsRepository().updateFinancialTransaction(
        "tx",
        "hotel",
        { status: "COMPLETED" },
        "actor",
      );
    expect(result.result).toBe("ok");
    expect(retry.update).toHaveBeenCalledWith({
      status: "COMPLETED",
      cash_session_id: "session",
    });
  });

  it("sem sessão aberta, mantém a recusa", async () => {
    mocks.from
      .mockReturnValueOnce(query({ data: null, error: refusal }))
      .mockReturnValueOnce(query({ data: null, error: null }));
    await expect(
      createFinancialTransactionsRepository().updateFinancialTransaction(
        "tx",
        "hotel",
        { status: "COMPLETED" },
        "actor",
      ),
    ).rejects.toEqual(refusal);
  });

  it("sem saber quem conclui, não procura sessão", async () => {
    mocks.from.mockReturnValueOnce(query({ data: null, error: refusal }));
    await expect(
      createFinancialTransactionsRepository().updateFinancialTransaction(
        "tx",
        "hotel",
        { status: "COMPLETED" },
      ),
    ).rejects.toEqual(refusal);
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});
