import { describe, expect, it } from "vitest";
import type { AdminFinancialTransaction } from "@hotel/shared";
import { buildFinancialTransactionReportData } from "../../../../src/app/dashboard/transactions/_components/financialTransactionReportData";

const transactions: AdminFinancialTransaction[] = [
  {
    id: "income-1",
    hotel_id: "hotel-1",
    type: "INCOME",
    category: "Hospedagem",
    amount: 1000,
    currency: "BRL",
    description: "Reserva principal",
    status: "COMPLETED",
    payment_method: "PIX",
    paid_at: "2026-05-11T10:00:00.000Z",
    due_date: "2026-05-11",
    counterparty: "Ana Paula",
    cost_center: "Recepcao",
    reference_code: "RES-1"
  },
  {
    id: "expense-1",
    hotel_id: "hotel-1",
    type: "EXPENSE",
    category: "Manutencao",
    amount: 350,
    currency: "BRL",
    description: null,
    status: "PENDING",
    payment_method: null,
    paid_at: null,
    due_date: "2026-05-10",
    counterparty: "Fornecedor tecnico",
    cost_center: "Operacao",
    reference_code: "NF-20"
  }
];

describe("financialTransactionReportData", () => {
  it("monta metadados, resumo e linhas para o recorte filtrado", () => {
    const report = buildFinancialTransactionReportData({
      transactions: [transactions[0]!],
      scope: "filtered",
      totalTransactions: transactions.length,
      hotelLabel: "Hotel Demo",
      generatedBy: "Marina Costa",
      generatedAt: new Date("2026-06-09T12:30:00.000Z"),
      referenceDate: new Date("2026-05-12T12:00:00.000Z")
    });

    expect(report.fileName).toBe("relatorio-financeiro-hotel-demo-2026-06-09-recorte-filtrado.pdf");
    expect(report.scopeLabel).toBe("Recorte filtrado");
    expect(report.transactionCountLabel).toBe("1 de 2 lançamento(s)");
    expect(report.summaryRows).toContainEqual(expect.objectContaining({ label: "Resultado realizado" }));
    expect(report.tableRows).toHaveLength(1);
    expect(report.tableRows[0]).toEqual(
      expect.arrayContaining(["11/05/2026", "Receita", "Concluída", "Hospedagem", "Ana Paula", "Recepcao", "RES-1"])
    );
    expect(report.tableRows[0]?.[7]).toContain("1.000,00");
    expect(report.tableRows[0]?.[7]).toMatch(/^\+/);
  });

  it("monta relatorio de todas as transacoes do hotel", () => {
    const report = buildFinancialTransactionReportData({
      transactions,
      scope: "all",
      totalTransactions: transactions.length,
      hotelLabel: "Hotel Demo",
      generatedBy: "Marina Costa",
      generatedAt: new Date("2026-06-09T12:30:00.000Z"),
      referenceDate: new Date("2026-05-12T12:00:00.000Z")
    });

    expect(report.fileName).toBe("relatorio-financeiro-hotel-demo-2026-06-09-todas-do-hotel.pdf");
    expect(report.scopeLabel).toBe("Todas do hotel");
    expect(report.transactionCountLabel).toBe("2 lançamento(s)");
    expect(report.categoryRows).toContainEqual(
      expect.objectContaining({
        category: "Manutencao",
        count: "1"
      })
    );
    expect(report.tableRows[1]?.[7]).toContain("350,00");
    expect(report.tableRows[1]?.[7]).toMatch(/^-/);
  });
});
