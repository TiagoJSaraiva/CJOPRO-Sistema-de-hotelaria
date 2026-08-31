import type { AdminFinancialTransaction } from "@hotel/shared";
import {
  getFinancialTransactionSignedAmount,
  isFinancialTransactionDueSoon,
  isFinancialTransactionOverdue,
  isFinancialTransactionSettled,
} from "@hotel/shared";

export type ExpenseCategoryInsight = {
  category: string;
  amount: number;
  count: number;
  share: number;
};

export type FinancialTransactionInsights = {
  realizedIncome: number;
  realizedExpenses: number;
  realizedRefunds: number;
  netRealized: number;
  pendingExpenses: number;
  overdueExpenses: number;
  dueSoonExpenses: number;
  overdueCount: number;
  pendingCount: number;
  completedCount: number;
  averageExpense: number;
  topExpenseCategories: ExpenseCategoryInsight[];
  upcomingExpenses: AdminFinancialTransaction[];
};

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function getAmount(transaction: AdminFinancialTransaction): number {
  return Number(transaction.amount || 0);
}

function isActiveExpense(transaction: AdminFinancialTransaction): boolean {
  return (
    transaction.type === "EXPENSE" &&
    transaction.status !== "FAILED" &&
    transaction.status !== "CANCELLED"
  );
}

export function buildFinancialTransactionInsights(
  transactions: AdminFinancialTransaction[],
  referenceDate: Date = new Date(),
): FinancialTransactionInsights {
  let realizedIncome = 0;
  let realizedExpenses = 0;
  let realizedRefunds = 0;
  let pendingExpenses = 0;
  let overdueExpenses = 0;
  let dueSoonExpenses = 0;
  let overdueCount = 0;
  let pendingCount = 0;
  let completedCount = 0;
  let expenseCountForAverage = 0;

  const categoryTotals = new Map<string, { amount: number; count: number }>();

  for (const transaction of transactions) {
    const amount = getAmount(transaction);

    if (transaction.status === "COMPLETED") {
      completedCount += 1;
    }

    if (isFinancialTransactionSettled(transaction)) {
      if (transaction.type === "INCOME") {
        realizedIncome += amount;
      } else if (transaction.type === "EXPENSE") {
        realizedExpenses += amount;
        expenseCountForAverage += 1;
      } else {
        realizedRefunds += amount;
      }
    }

    if (isActiveExpense(transaction)) {
      const current = categoryTotals.get(transaction.category) || {
        amount: 0,
        count: 0,
      };
      categoryTotals.set(transaction.category, {
        amount: current.amount + amount,
        count: current.count + 1,
      });
    }

    if (transaction.type === "EXPENSE" && transaction.status === "PENDING") {
      pendingExpenses += amount;
      pendingCount += 1;

      if (isFinancialTransactionOverdue(transaction, referenceDate)) {
        overdueExpenses += amount;
        overdueCount += 1;
      }

      if (isFinancialTransactionDueSoon(transaction, referenceDate, 7)) {
        dueSoonExpenses += amount;
      }
    }
  }

  const categoryGrandTotal = Array.from(categoryTotals.values()).reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const topExpenseCategories = Array.from(categoryTotals.entries())
    .map(([category, item]) => ({
      category,
      amount: roundMoney(item.amount),
      count: item.count,
      share:
        categoryGrandTotal > 0
          ? Math.round((item.amount / categoryGrandTotal) * 100)
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const upcomingExpenses = transactions
    .filter(
      (transaction) =>
        transaction.type === "EXPENSE" && transaction.status === "PENDING",
    )
    .sort((a, b) =>
      String(a.due_date || "9999-12-31").localeCompare(
        String(b.due_date || "9999-12-31"),
      ),
    )
    .slice(0, 5);

  const netRealized = transactions
    .filter((transaction) => isFinancialTransactionSettled(transaction))
    .reduce(
      (sum, transaction) =>
        sum + getFinancialTransactionSignedAmount(transaction),
      0,
    );

  return {
    realizedIncome: roundMoney(realizedIncome),
    realizedExpenses: roundMoney(realizedExpenses),
    realizedRefunds: roundMoney(realizedRefunds),
    netRealized: roundMoney(netRealized),
    pendingExpenses: roundMoney(pendingExpenses),
    overdueExpenses: roundMoney(overdueExpenses),
    dueSoonExpenses: roundMoney(dueSoonExpenses),
    overdueCount,
    pendingCount,
    completedCount,
    averageExpense:
      expenseCountForAverage > 0
        ? roundMoney(realizedExpenses / expenseCountForAverage)
        : 0,
    topExpenseCategories,
    upcomingExpenses,
  };
}
