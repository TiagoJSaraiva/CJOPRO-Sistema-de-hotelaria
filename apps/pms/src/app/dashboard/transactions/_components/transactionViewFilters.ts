import type { AdminFinancialTransaction, TransactionStatus, TransactionType } from "@hotel/shared";

export type TransactionViewFilters = {
  search: string;
  type: "all" | TransactionType;
  status: "all" | TransactionStatus;
  minAmount: string;
  maxAmount: string;
};

export const DEFAULT_TRANSACTION_VIEW_FILTERS: TransactionViewFilters = {
  search: "",
  type: "all",
  status: "all",
  minAmount: "",
  maxAmount: ""
};

export function countAppliedTransactionFilters(filters: TransactionViewFilters): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.type !== "all") total += 1;
  if (filters.status !== "all") total += 1;
  if (filters.minAmount.trim()) total += 1;
  if (filters.maxAmount.trim()) total += 1;

  return total;
}

export function applyTransactionViewFilters(
  transactions: AdminFinancialTransaction[],
  filters: TransactionViewFilters
): AdminFinancialTransaction[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const minAmount = Number(filters.minAmount || "");
  const maxAmount = Number(filters.maxAmount || "");

  return transactions.filter((transaction) => {
    if (search) {
      const haystack = `${transaction.category} ${transaction.description || ""}`.toLocaleLowerCase();

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

    if (filters.minAmount.trim() && (!Number.isFinite(minAmount) || transaction.amount < minAmount)) {
      return false;
    }

    if (filters.maxAmount.trim() && (!Number.isFinite(maxAmount) || transaction.amount > maxAmount)) {
      return false;
    }

    return true;
  });
}
