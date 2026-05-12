import { describe, expect, it } from "vitest";
import type { AdminFinancialTransaction } from "@hotel/shared";
import { buildFinancialTransactionInsights } from "../../../../src/app/dashboard/transactions/_components/financialTransactionInsights";

describe("financialTransactionInsights", () => {
  it("consolida indicadores de caixa e gastos pendentes", () => {
    const transactions: AdminFinancialTransaction[] = [
      {
        id: "income-1",
        hotel_id: "hotel-1",
        type: "INCOME",
        category: "Hospedagem",
        amount: 1000,
        currency: "BRL",
        description: null,
        status: "COMPLETED",
        paid_at: "2026-05-11T10:00:00.000Z"
      },
      {
        id: "expense-1",
        hotel_id: "hotel-1",
        type: "EXPENSE",
        category: "Lavanderia",
        amount: 200,
        currency: "BRL",
        description: null,
        status: "COMPLETED",
        paid_at: "2026-05-10T10:00:00.000Z"
      },
      {
        id: "expense-2",
        hotel_id: "hotel-1",
        type: "EXPENSE",
        category: "Manutencao",
        amount: 350,
        currency: "BRL",
        description: null,
        status: "PENDING",
        due_date: "2026-05-10"
      },
      {
        id: "refund-1",
        hotel_id: "hotel-1",
        type: "REFUND",
        category: "Estorno",
        amount: 100,
        currency: "BRL",
        description: null,
        status: "REFUNDED",
        paid_at: "2026-05-09T10:00:00.000Z"
      }
    ];

    const insights = buildFinancialTransactionInsights(transactions, new Date("2026-05-12T12:00:00.000Z"));

    expect(insights.realizedIncome).toBe(1000);
    expect(insights.realizedExpenses).toBe(200);
    expect(insights.realizedRefunds).toBe(100);
    expect(insights.netRealized).toBe(700);
    expect(insights.pendingExpenses).toBe(350);
    expect(insights.overdueExpenses).toBe(350);
    expect(insights.overdueCount).toBe(1);
    expect(insights.topExpenseCategories.map((item) => item.category)).toEqual(["Manutencao", "Lavanderia"]);
  });
});
