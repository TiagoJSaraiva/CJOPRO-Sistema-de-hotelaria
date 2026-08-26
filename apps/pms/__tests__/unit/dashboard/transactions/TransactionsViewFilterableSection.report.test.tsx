// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminFinancialTransaction } from "@hotel/shared";
import type { ReactNode } from "react";
import { TransactionsViewFilterableSection } from "../../../../src/app/dashboard/transactions/_components/TransactionsViewFilterableSection";
import type { FinancialTransactionReportInput } from "../../../../src/app/dashboard/transactions/_components/financialTransactionReportData";

const generatePdfMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("next/link", () => ({
  default: ({ href, children, scroll, ...props }: { href: string; children: ReactNode; scroll?: boolean }) => {
    void scroll;
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
}));

vi.mock("../../../../src/app/dashboard/transactions/actions", () => ({
  deleteTransactionAction: vi.fn(),
  updateTransactionAction: vi.fn()
}));

vi.mock("../../../../src/app/dashboard/transactions/_components/financialTransactionPdf", () => ({
  generateFinancialTransactionsPdf: generatePdfMock
}));

const transactions: AdminFinancialTransaction[] = [
  {
    id: "transaction-1",
    hotel_id: "hotel-1",
    type: "INCOME",
    category: "Hospedagem",
    amount: 1280,
    currency: "BRL",
    description: "Reserva RES-1001",
    status: "COMPLETED",
    payment_method: "pix",
    paid_at: "2026-05-10T12:00:00.000Z",
    due_date: "2026-05-10",
    counterparty: "Ana Paula Ribeiro",
    cost_center: "Recepcao",
    reference_code: "RES-1001",
    created_at: "2026-05-10T10:00:00.000Z",
    updated_at: "2026-05-10T12:00:00.000Z"
  },
  {
    id: "transaction-2",
    hotel_id: "hotel-1",
    type: "EXPENSE",
    category: "Energia eletrica",
    amount: 640,
    currency: "BRL",
    description: "Conta mensal",
    status: "PENDING",
    payment_method: "bank_transfer",
    paid_at: null,
    due_date: "2026-05-15",
    counterparty: "Companhia de Energia",
    cost_center: "Operacao",
    reference_code: "ENE-0526",
    created_at: "2026-05-08T10:00:00.000Z",
    updated_at: "2026-05-08T10:00:00.000Z"
  }
];

function renderTransactionsSection() {
  render(
    <TransactionsViewFilterableSection
      transactions={transactions}
      canCreate
      canRead
      canUpdate
      canDelete
      activeTransactionId=""
      mode="view"
      reportContext={{
        hotelLabel: "Hotel Demo",
        generatedBy: "Marina Costa",
        hasActiveHotel: true
      }}
    />
  );
}

describe("TransactionsViewFilterableSection report menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("gera relatorio do recorte filtrado ou de todas as transacoes", async () => {
    const user = userEvent.setup();
    renderTransactionsSection();

    await user.click(screen.getByRole("button", { name: "Filtrar dados" }));
    await user.type(screen.getByPlaceholderText("Categoria, fornecedor, descrição ou referência"), "Energia");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(screen.getByText("Exibindo 1 de 2 lançamentos financeiros.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Gerar relatório" }));
    await user.click(screen.getByRole("menuitem", { name: "Recorte filtrado" }));

    const calls = generatePdfMock.mock.calls as unknown as Array<[FinancialTransactionReportInput]>;
    const filteredCall = calls[0]?.[0];
    expect(filteredCall).toBeDefined();
    if (!filteredCall) return;

    expect(filteredCall.scope).toBe("filtered");
    expect(filteredCall.totalTransactions).toBe(2);
    expect(filteredCall.hotelLabel).toBe("Hotel Demo");
    expect(filteredCall.generatedBy).toBe("Marina Costa");
    expect(filteredCall.transactions.map((transaction: AdminFinancialTransaction) => transaction.id)).toEqual(["transaction-2"]);

    await user.click(screen.getByRole("button", { name: "Gerar relatório" }));
    await user.click(screen.getByRole("menuitem", { name: "Todas do hotel" }));

    const allCall = calls[1]?.[0];
    expect(allCall).toBeDefined();
    if (!allCall) return;

    expect(allCall.scope).toBe("all");
    expect(allCall.transactions.map((transaction: AdminFinancialTransaction) => transaction.id)).toEqual(["transaction-1", "transaction-2"]);
  });
});
