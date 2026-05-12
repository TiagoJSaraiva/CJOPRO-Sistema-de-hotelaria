import type { AdminFinancialTransaction, TransactionStatus, TransactionType } from "@hotel/shared";
import {
  getFinancialTransactionEffectiveDate,
  isFinancialTransactionDueSoon,
  isFinancialTransactionOverdue,
  isFinancialTransactionSettled
} from "@hotel/shared";

export type TransactionViewFilters = {
  search: string;
  type: "all" | TransactionType;
  status: "all" | TransactionStatus;
  settlement: "all" | "paid" | "open" | "overdue" | "due_soon";
  costCenter: string;
  paymentMethod: string;
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
};

export const DEFAULT_TRANSACTION_VIEW_FILTERS: TransactionViewFilters = {
  search: "",
  type: "all",
  status: "all",
  settlement: "all",
  costCenter: "",
  paymentMethod: "",
  dateFrom: "",
  dateTo: "",
  minAmount: "",
  maxAmount: ""
};

export function countAppliedTransactionFilters(filters: TransactionViewFilters): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.type !== "all") total += 1;
  if (filters.status !== "all") total += 1;
  if (filters.settlement !== "all") total += 1;
  if (filters.costCenter.trim()) total += 1;
  if (filters.paymentMethod.trim()) total += 1;
  if (filters.dateFrom.trim()) total += 1;
  if (filters.dateTo.trim()) total += 1;
  if (filters.minAmount.trim()) total += 1;
  if (filters.maxAmount.trim()) total += 1;

  return total;
}

export function applyTransactionViewFilters(
  transactions: AdminFinancialTransaction[],
  filters: TransactionViewFilters,
  referenceDate: Date = new Date()
): AdminFinancialTransaction[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const costCenter = filters.costCenter.trim().toLocaleLowerCase();
  const paymentMethod = filters.paymentMethod.trim().toLocaleLowerCase();
  const dateFrom = filters.dateFrom.trim();
  const dateTo = filters.dateTo.trim();
  const minAmount = Number(filters.minAmount || "");
  const maxAmount = Number(filters.maxAmount || "");

  return transactions.filter((transaction) => {
    if (search) {
      const haystack = [
        transaction.category,
        transaction.description,
        transaction.counterparty,
        transaction.cost_center,
        transaction.reference_code,
        transaction.payment_method
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (filters.type !== "all" && transaction.type !== filters.type) {
      return false;
    }

    if (filters.status !== "all" && transaction.status !== filters.status) {
      return false;
    }

    if (filters.settlement === "paid" && !isFinancialTransactionSettled(transaction)) {
      return false;
    }

    if (filters.settlement === "open" && transaction.status !== "PENDING") {
      return false;
    }

    if (filters.settlement === "overdue" && !isFinancialTransactionOverdue(transaction, referenceDate)) {
      return false;
    }

    if (filters.settlement === "due_soon" && !isFinancialTransactionDueSoon(transaction, referenceDate, 7)) {
      return false;
    }

    if (costCenter && !String(transaction.cost_center || "").toLocaleLowerCase().includes(costCenter)) {
      return false;
    }

    if (paymentMethod && !String(transaction.payment_method || "").toLocaleLowerCase().includes(paymentMethod)) {
      return false;
    }

    if (dateFrom || dateTo) {
      const effectiveDate = getFinancialTransactionEffectiveDate(transaction);
      const dateKey = effectiveDate ? effectiveDate.slice(0, 10) : "";

      if (!dateKey) {
        return false;
      }

      if (dateFrom && dateKey < dateFrom) {
        return false;
      }

      if (dateTo && dateKey > dateTo) {
        return false;
      }
    }

    if (filters.minAmount.trim() && (!Number.isFinite(minAmount) || transaction.amount < minAmount)) {
      return false;
    }

    if (filters.maxAmount.trim() && (!Number.isFinite(maxAmount) || transaction.amount > maxAmount)) {
      return false;
    }

    return true;
  });
}
