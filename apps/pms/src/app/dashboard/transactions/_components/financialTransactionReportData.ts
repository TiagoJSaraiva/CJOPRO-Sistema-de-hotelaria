import type { AdminFinancialTransaction } from "@hotel/shared";
import {
  getFinancialTransactionEffectiveDate,
  getFinancialTransactionSignedAmount,
  translateTransactionStatus,
  translateTransactionType
} from "@hotel/shared";
import { buildFinancialTransactionInsights } from "./financialTransactionInsights";

export type FinancialTransactionReportScope = "filtered" | "all";

export type FinancialTransactionReportInput = {
  transactions: AdminFinancialTransaction[];
  scope: FinancialTransactionReportScope;
  totalTransactions: number;
  hotelLabel: string;
  generatedBy: string;
  generatedAt: Date;
  referenceDate: Date;
};

export type FinancialTransactionReportData = {
  title: string;
  fileName: string;
  scopeLabel: string;
  hotelLabel: string;
  generatedBy: string;
  generatedAtLabel: string;
  transactionCountLabel: string;
  summaryRows: Array<{ label: string; value: string }>;
  categoryRows: Array<{ category: string; amount: string; count: string; share: string }>;
  tableRows: string[][];
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatMoney(amount: number, currency = "BRL"): string {
  const value = Number(amount || 0);

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatSignedMoney(amount: number, currency = "BRL"): string {
  const value = Number(amount || 0);

  if (value === 0) {
    return formatMoney(0, currency);
  }

  return value > 0 ? `+${formatMoney(value, currency)}` : `-${formatMoney(Math.abs(value), currency)}`;
}

function formatDateKey(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const dateKey = value.slice(0, 10);

  if (DATE_ONLY_PATTERN.test(dateKey)) {
    return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}/${dateKey.slice(0, 4)}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function sanitizeFilePart(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "hotel";
}

function getScopeLabel(scope: FinancialTransactionReportScope): string {
  return scope === "filtered" ? "Recorte filtrado" : "Todas do hotel";
}

function getScopeFilePart(scope: FinancialTransactionReportScope): string {
  return scope === "filtered" ? "recorte-filtrado" : "todas-do-hotel";
}

function buildTransactionCountLabel(scope: FinancialTransactionReportScope, count: number, total: number): string {
  if (scope === "filtered" && total !== count) {
    return `${count} de ${total} lançamento(s)`;
  }

  return `${count} lançamento(s)`;
}

function buildTableRows(transactions: AdminFinancialTransaction[]): string[][] {
  return transactions.map((transaction) => {
    const effectiveDate = getFinancialTransactionEffectiveDate(transaction);
    const signedAmount = getFinancialTransactionSignedAmount(transaction);

    return [
      formatDateKey(effectiveDate),
      translateTransactionType(transaction.type),
      translateTransactionStatus(transaction.status),
      transaction.category || "-",
      transaction.counterparty || "-",
      transaction.cost_center || "-",
      transaction.reference_code || "-",
      formatSignedMoney(signedAmount, transaction.currency)
    ];
  });
}

export function buildFinancialTransactionReportData(input: FinancialTransactionReportInput): FinancialTransactionReportData {
  const insights = buildFinancialTransactionInsights(input.transactions, input.referenceDate);
  const scopeLabel = getScopeLabel(input.scope);
  const safeHotelName = sanitizeFilePart(input.hotelLabel);
  const fileName = `relatorio-financeiro-${safeHotelName}-${toDateKey(input.generatedAt)}-${getScopeFilePart(input.scope)}.pdf`;

  return {
    title: "Relatório financeiro",
    fileName,
    scopeLabel,
    hotelLabel: input.hotelLabel,
    generatedBy: input.generatedBy,
    generatedAtLabel: formatDateTime(input.generatedAt),
    transactionCountLabel: buildTransactionCountLabel(input.scope, input.transactions.length, input.totalTransactions),
    summaryRows: [
      { label: "Resultado realizado", value: formatMoney(insights.netRealized) },
      { label: "Receitas realizadas", value: formatMoney(insights.realizedIncome) },
      { label: "Gastos realizados", value: formatMoney(insights.realizedExpenses) },
      { label: "Reembolsos realizados", value: formatMoney(insights.realizedRefunds) },
      { label: "Gastos pendentes", value: formatMoney(insights.pendingExpenses) },
      { label: "Despesas vencidas", value: formatMoney(insights.overdueExpenses) },
      { label: "Proximos 7 dias", value: formatMoney(insights.dueSoonExpenses) },
      { label: "Ticket medio de gasto", value: formatMoney(insights.averageExpense) }
    ],
    categoryRows: insights.topExpenseCategories.map((category) => ({
      category: category.category,
      amount: formatMoney(category.amount),
      count: `${category.count}`,
      share: `${category.share}%`
    })),
    tableRows: buildTableRows(input.transactions)
  };
}
