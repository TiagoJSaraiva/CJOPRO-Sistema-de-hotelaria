import type { AdminFinancialTransaction } from "./admin";
import { instantToHotelDate } from "./hotelTime";

const SETTLED_TRANSACTION_STATUSES = new Set(["COMPLETED", "REFUNDED"]);
const IGNORED_CASHFLOW_STATUSES = new Set(["FAILED", "CANCELLED"]);

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;

  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isFinancialTransactionSettled(
  transaction: Pick<AdminFinancialTransaction, "status">,
): boolean {
  return SETTLED_TRANSACTION_STATUSES.has(transaction.status);
}

export function getFinancialTransactionSignedAmount(
  transaction: Pick<AdminFinancialTransaction, "amount" | "type" | "status">,
): number {
  if (IGNORED_CASHFLOW_STATUSES.has(transaction.status)) {
    return 0;
  }

  const amount = Number(transaction.amount || 0);

  if (transaction.type === "INCOME") {
    return amount;
  }

  return -amount;
}

export function getFinancialTransactionEffectiveDate(
  transaction: Pick<
    AdminFinancialTransaction,
    "paid_at" | "due_date" | "created_at"
  >,
): string | null {
  return (
    transaction.paid_at ||
    transaction.due_date ||
    transaction.created_at ||
    null
  );
}

/**
 * Dia do hotel em que o lançamento conta. Vencimento já é uma data; pagamento e criação
 * são instantes e precisam do fuso, senão o que acontece à noite cai no dia seguinte.
 */
export function getFinancialTransactionEffectiveDateKey(
  transaction: Pick<
    AdminFinancialTransaction,
    "paid_at" | "due_date" | "created_at"
  >,
  timeZone: string,
): string {
  if (transaction.paid_at)
    return instantToHotelDate(transaction.paid_at, timeZone);
  if (transaction.due_date) return transaction.due_date;
  return instantToHotelDate(transaction.created_at, timeZone);
}

/** Converte a data operacional na referência esperada pelas regras de vencimento. */
export function financialReferenceDate(operationalDate: string): Date {
  return new Date(`${operationalDate}T12:00:00.000Z`);
}

export function isFinancialTransactionOverdue(
  transaction: Pick<AdminFinancialTransaction, "status" | "due_date">,
  referenceDate: Date,
): boolean {
  if (transaction.status !== "PENDING") {
    return false;
  }

  const dueDate = parseDateOnly(transaction.due_date);
  if (!dueDate) {
    return false;
  }

  return toUtcDateKey(dueDate) < toUtcDateKey(referenceDate);
}

export function isFinancialTransactionDueSoon(
  transaction: Pick<AdminFinancialTransaction, "status" | "due_date">,
  referenceDate: Date,
  daysAhead = 7,
): boolean {
  if (transaction.status !== "PENDING") {
    return false;
  }

  const dueDate = parseDateOnly(transaction.due_date);
  if (!dueDate) {
    return false;
  }

  const start = new Date(`${toUtcDateKey(referenceDate)}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + daysAhead);

  return dueDate >= start && dueDate <= end;
}
