import { describe, expect, it } from "vitest";
import {
  getFinancialTransactionEffectiveDate,
  getFinancialTransactionSignedAmount,
  isFinancialTransactionDueSoon,
  isFinancialTransactionOverdue,
  isFinancialTransactionSettled,
} from "../../src/financial";

describe("financial helpers", () => {
  it("calcula sinal financeiro ignorando transacoes canceladas ou falhas", () => {
    expect(
      getFinancialTransactionSignedAmount({
        type: "INCOME",
        status: "COMPLETED",
        amount: 100,
      }),
    ).toBe(100);
    expect(
      getFinancialTransactionSignedAmount({
        type: "EXPENSE",
        status: "COMPLETED",
        amount: 40,
      }),
    ).toBe(-40);
    expect(
      getFinancialTransactionSignedAmount({
        type: "REFUND",
        status: "REFUNDED",
        amount: 15,
      }),
    ).toBe(-15);
    expect(
      getFinancialTransactionSignedAmount({
        type: "EXPENSE",
        status: "CANCELLED",
        amount: 40,
      }),
    ).toBe(0);
  });

  it("identifica vencidas, proximas e data efetiva", () => {
    const referenceDate = new Date("2026-05-12T12:00:00.000Z");

    expect(isFinancialTransactionSettled({ status: "COMPLETED" })).toBe(true);
    expect(
      isFinancialTransactionOverdue(
        { status: "PENDING", due_date: "2026-05-10" },
        referenceDate,
      ),
    ).toBe(true);
    expect(
      isFinancialTransactionDueSoon(
        { status: "PENDING", due_date: "2026-05-17" },
        referenceDate,
      ),
    ).toBe(true);
    expect(
      getFinancialTransactionEffectiveDate({
        paid_at: null,
        due_date: "2026-05-17",
        created_at: "2026-05-01T00:00:00.000Z",
      }),
    ).toBe("2026-05-17");
  });
});
