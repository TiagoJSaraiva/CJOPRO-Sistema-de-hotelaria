// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AdminFinancialTransaction } from "@hotel/shared";
import type { ReactNode } from "react";
import { TransactionListItem } from "../../../../src/app/dashboard/transactions/_components/TransactionListItem";
import { TransactionsViewFilterableSection } from "../../../../src/app/dashboard/transactions/_components/TransactionsViewFilterableSection";
import {
  DEFAULT_TRANSACTION_VIEW_FILTERS,
  applyTransactionViewFilters,
} from "../../../../src/app/dashboard/transactions/_components/transactionViewFilters";
import { buildFinancialTransactionReportData } from "../../../../src/app/dashboard/transactions/_components/financialTransactionReportData";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/transactions/view",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../../../../src/app/dashboard/transactions/actions", () => ({
  deleteTransactionAction: vi.fn(),
  updateTransactionAction: vi.fn(),
}));
vi.mock(
  "../../../../src/app/dashboard/transactions/_components/financialTransactionPdf",
  () => ({ generateFinancialTransactionsPdf: vi.fn() }),
);

const SAO_PAULO = "America/Sao_Paulo";
const NOVEMBER_4 = new Date("2026-11-04T12:00:00.000Z");

const base: AdminFinancialTransaction = {
  id: "t1",
  hotel_id: "hotel-1",
  type: "EXPENSE",
  category: "Limpeza",
  amount: 100,
  currency: "BRL",
  description: null,
  status: "PENDING",
  payment_method: null,
  paid_at: null,
  due_date: null,
  counterparty: null,
  cost_center: null,
  reference_code: null,
};

function renderItem(transaction: AdminFinancialTransaction, isEditing = false) {
  render(
    <TransactionListItem
      transaction={transaction}
      timeZone={SAO_PAULO}
      referenceDate={NOVEMBER_4}
      canRead
      canUpdate
      canDelete
      isViewing={false}
      isEditing={isEditing}
    />,
  );
}

afterEach(cleanup);

describe("horários da transação no fuso do hotel", () => {
  it("o campo de edição mostra o pagamento na hora do hotel", () => {
    renderItem(
      {
        ...base,
        status: "COMPLETED",
        paid_at: "2026-11-04T22:30:00.000Z",
      },
      true,
    );
    const field = document.querySelector<HTMLInputElement>(
      'input[name="paid_at"]',
    );
    expect(field?.value).toBe("2026-11-04T19:30");
  });

  it("o vencimento aparece no dia informado, sem recuar um dia", () => {
    renderItem({ ...base, due_date: "2026-11-05" });
    expect(screen.getByText("05/11/2026")).toBeTruthy();
    expect(screen.queryByText("04/11/2026")).toBeNull();
  });

  it("não marca como atrasado o que vence no dia operacional", () => {
    renderItem({ ...base, due_date: "2026-11-04" });
    expect(screen.queryByText(/atrasad|vencid/i)).toBeNull();
  });

  it("marca como atrasado o que venceu antes do dia operacional", () => {
    renderItem({ ...base, due_date: "2026-11-03" });
    expect(screen.getAllByText(/atrasad|vencid/i).length).toBeGreaterThan(0);
  });

  it("a tela usa a data operacional do hotel, não o relógio do navegador", () => {
    render(
      <TransactionsViewFilterableSection
        transactions={[{ ...base, due_date: "2030-01-01" }]}
        hotelClock={{
          timezone: SAO_PAULO,
          operational_date: "2030-01-02",
          operational_now: "2030-01-02T15:00:00.000Z",
        }}
        canCreate
        canRead
        canUpdate
        canDelete
        activeTransactionId=""
        mode="view"
        reportContext={{
          hotelLabel: "Hotel",
          generatedBy: "Pessoa",
          hasActiveHotel: true,
        }}
      />,
    );
    expect(screen.getAllByText(/atrasad|vencid/i).length).toBeGreaterThan(0);
  });

  it("o filtro de período conta o pagamento noturno no dia do hotel", () => {
    const night = {
      ...base,
      status: "COMPLETED" as const,
      paid_at: "2026-11-05T01:30:00.000Z", // 22:30 de 04/11 no hotel
    };
    const filter = (dateFrom: string, dateTo: string) =>
      applyTransactionViewFilters(
        [night],
        { ...DEFAULT_TRANSACTION_VIEW_FILTERS, dateFrom, dateTo },
        NOVEMBER_4,
        SAO_PAULO,
      );

    expect(filter("2026-11-04", "2026-11-04")).toHaveLength(1);
    expect(filter("2026-11-05", "2026-11-05")).toHaveLength(0);
  });

  it("o relatório mostra o pagamento noturno no dia do hotel", () => {
    const report = buildFinancialTransactionReportData({
      transactions: [
        {
          ...base,
          status: "COMPLETED",
          paid_at: "2026-11-05T01:30:00.000Z",
        },
      ],
      scope: "all",
      totalTransactions: 1,
      hotelLabel: "Hotel",
      generatedBy: "Pessoa",
      generatedAt: new Date("2026-11-05T01:30:00.000Z"),
      referenceDate: NOVEMBER_4,
      timeZone: SAO_PAULO,
    });

    expect(report.tableRows[0]?.[0]).toBe("04/11/2026");
    expect(report.fileName).toContain("2026-11-04");
    expect(report.generatedAtLabel).toContain("04/11/2026");
    expect(report.generatedAtLabel).toContain("22:30");
  });
});
