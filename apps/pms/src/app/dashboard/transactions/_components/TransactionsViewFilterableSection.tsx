"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { AdminFinancialTransaction } from "@hotel/shared";
import { translateTransactionStatus, translateTransactionType } from "@hotel/shared";
import {
  DEFAULT_TRANSACTION_VIEW_FILTERS,
  applyTransactionViewFilters,
  countAppliedTransactionFilters,
  type TransactionViewFilters
} from "./transactionViewFilters";
import { FinancialTransactionReportMenu } from "./FinancialTransactionReportMenu";
import { buildFinancialTransactionInsights } from "./financialTransactionInsights";
import { TransactionListItem } from "./TransactionListItem";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { shouldPlaceTabsInFilterBar } from "../../_components/DashboardEntityTabsLayout";
import { useDashboardEntityTabs } from "../../_components/DashboardEntityTabsContext";
import { ViewFiltersActionsBar, ViewFiltersModal, viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { useViewFiltersState } from "../../_components/useViewFiltersState";

type TransactionsViewFilterableSectionProps = {
  transactions: AdminFinancialTransaction[];
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  activeTransactionId: string;
  mode: "view" | "edit";
  reportContext: {
    hotelLabel: string;
    generatedBy: string;
    hasActiveHotel: boolean;
  };
};

function formatMoney(amount: number, currency = "BRL"): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Sem vencimento";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "good" | "danger" | "warning";
}) {
  const toneClassName = {
    neutral: "border-[#d9dfe7] bg-white text-[#202939]",
    good: "border-[#b6e4cb] bg-[#f1fbf5] text-[#176c43]",
    danger: "border-[#f3b2b2] bg-[#fff5f5] text-[#b42318]",
    warning: "border-[#f5d08a] bg-[#fff9eb] text-[#8a5a00]"
  }[tone];

  return (
    <article className={`rounded-lg border p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${toneClassName}`}>
      <span className="block text-[0.76rem] font-semibold uppercase tracking-[0.05em] text-[#697586]">{label}</span>
      <strong className="mt-2 block text-[1.45rem] leading-tight">{value}</strong>
      <p className="mb-0 mt-2 text-[0.86rem] text-[#52606d]">{detail}</p>
    </article>
  );
}

function ExpenseCategoriesPanel({ transactions, referenceDate }: { transactions: AdminFinancialTransaction[]; referenceDate: Date }) {
  const insights = buildFinancialTransactionInsights(transactions, referenceDate);

  return (
    <aside className="grid gap-4 rounded-lg border border-[#d9dfe7] bg-white p-4">
      <div>
        <h3 className="m-0 text-[1rem] text-[#121926]">Categorias de gasto</h3>
        <p className="mb-0 mt-[0.25rem] text-[0.86rem] text-[#697586]">Participação das principais despesas no recorte atual.</p>
      </div>

      <div className="grid gap-3">
        {insights.topExpenseCategories.length ? (
          insights.topExpenseCategories.map((category) => (
            <div key={category.category} className="grid gap-[0.35rem]">
              <div className="flex items-center justify-between gap-3 text-[0.88rem]">
                <strong className="truncate text-[#202939]">{category.category}</strong>
                <span className="text-[#52606d]">{formatMoney(category.amount)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#eef2f6]">
                <div className="h-full rounded-full bg-[#1b7a6c]" style={{ width: `${Math.max(category.share, 4)}%` }} />
              </div>
              <span className="text-[0.78rem] text-[#697586]">{category.share}% em {category.count} lançamento(s)</span>
            </div>
          ))
        ) : (
          <p className="m-0 rounded-lg border border-dashed border-[#d9dfe7] p-3 text-[0.9rem] text-[#697586]">
            Sem despesas para consolidar neste recorte.
          </p>
        )}
      </div>
    </aside>
  );
}

function UpcomingExpensesPanel({ transactions, referenceDate }: { transactions: AdminFinancialTransaction[]; referenceDate: Date }) {
  const insights = buildFinancialTransactionInsights(transactions, referenceDate);

  return (
    <aside className="grid gap-4 rounded-lg border border-[#d9dfe7] bg-white p-4">
      <div>
        <h3 className="m-0 text-[1rem] text-[#121926]">Agenda de vencimentos</h3>
        <p className="mb-0 mt-[0.25rem] text-[0.86rem] text-[#697586]">Proximas despesas pendentes para acompanhamento.</p>
      </div>

      <div className="grid gap-2">
        {insights.upcomingExpenses.length ? (
          insights.upcomingExpenses.map((transaction) => (
            <div key={transaction.id} className="rounded-lg border border-[#eef2f6] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block truncate text-[0.9rem] text-[#202939]">{transaction.category}</strong>
                  <span className="block truncate text-[0.8rem] text-[#697586]">{transaction.counterparty || transaction.cost_center || "Sem fornecedor"}</span>
                </div>
                <span className="whitespace-nowrap text-[0.88rem] font-semibold text-[#b42318]">{formatMoney(transaction.amount, transaction.currency)}</span>
              </div>
              <span className="mt-2 block text-[0.78rem] text-[#697586]">{formatDate(transaction.due_date)}</span>
            </div>
          ))
        ) : (
          <p className="m-0 rounded-lg border border-dashed border-[#d9dfe7] p-3 text-[0.9rem] text-[#697586]">
            Nenhuma despesa pendente cadastrada.
          </p>
        )}
      </div>
    </aside>
  );
}

export function TransactionsViewFilterableSection({
  transactions,
  canCreate,
  canRead,
  canUpdate,
  canDelete,
  activeTransactionId,
  mode,
  reportContext
}: TransactionsViewFilterableSectionProps) {
  const referenceDate = useMemo(() => new Date(), []);
  const tabsContext = useDashboardEntityTabs();
  const viewTabs = tabsContext && shouldPlaceTabsInFilterBar(tabsContext.activeTabKey) ? (
    <PermissionTabs activeKey={tabsContext.activeTabKey} items={tabsContext.tabs} className="pms-entity-tabs-inline" />
  ) : null;
  const {
    isModalOpen,
    appliedFilters,
    draftFilters,
    openFilters,
    closeFilters,
    applyFilters,
    clearFilters,
    updateDraftFilter
  } = useViewFiltersState<TransactionViewFilters>(DEFAULT_TRANSACTION_VIEW_FILTERS);

  const filteredTransactions = useMemo(
    () => applyTransactionViewFilters(transactions, appliedFilters, referenceDate),
    [transactions, appliedFilters, referenceDate]
  );
  const appliedFilterCount = countAppliedTransactionFilters(appliedFilters);
  const insights = useMemo(() => buildFinancialTransactionInsights(transactions, referenceDate), [transactions, referenceDate]);

  return (
    <section className="grid gap-4">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Resultado realizado"
          value={formatMoney(insights.netRealized)}
          detail={`${formatMoney(insights.realizedIncome)} em receitas, ${formatMoney(insights.realizedExpenses)} em gastos`}
          tone={insights.netRealized >= 0 ? "good" : "danger"}
        />
        <MetricCard
          label="Gastos pendentes"
          value={formatMoney(insights.pendingExpenses)}
          detail={`${insights.pendingCount} lançamento(s) aguardando baixa`}
          tone={insights.pendingExpenses > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Vencidos"
          value={formatMoney(insights.overdueExpenses)}
          detail={`${insights.overdueCount} despesa(s) fora do prazo`}
          tone={insights.overdueExpenses > 0 ? "danger" : "good"}
        />
        <MetricCard
          label="Próximos 7 dias"
          value={formatMoney(insights.dueSoonExpenses)}
          detail={`Ticket medio de gasto: ${formatMoney(insights.averageExpense)}`}
          tone="neutral"
        />
      </section>

      <ViewFiltersActionsBar appliedFilterCount={appliedFilterCount} onOpen={openFilters} onClear={clearFilters}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">{viewTabs}</div>
          <FinancialTransactionReportMenu
            allTransactions={transactions}
            filteredTransactions={filteredTransactions}
            hotelLabel={reportContext.hotelLabel}
            generatedBy={reportContext.generatedBy}
            hasActiveHotel={reportContext.hasActiveHotel}
            referenceDate={referenceDate}
          />
          {canCreate ? (
            <Link href="/dashboard/transactions/create" className="rounded-lg border border-[#14564c] bg-[#1b7a6c] px-[0.75rem] py-[0.5rem] font-semibold text-white no-underline">
              Novo lançamento
            </Link>
          ) : null}
        </div>
      </ViewFiltersActionsBar>

      <p className="pms-status-muted">
        Exibindo {filteredTransactions.length} de {transactions.length} lançamentos financeiros.
      </p>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3">
          {filteredTransactions.length ? (
            filteredTransactions.map((transaction) => (
              <TransactionListItem
                key={transaction.id}
                transaction={transaction}
                canRead={canRead}
                canUpdate={canUpdate}
                canDelete={canDelete}
                isViewing={activeTransactionId === transaction.id && mode === "view"}
                isEditing={activeTransactionId === transaction.id && mode === "edit"}
              />
            ))
          ) : (
            <article className="pms-empty-state">
              {appliedFilterCount ? "Nenhum lançamento corresponde aos filtros aplicados." : "Nenhum lançamento financeiro cadastrado até o momento."}
            </article>
          )}
        </div>

        <div className="grid content-start gap-4">
          <ExpenseCategoriesPanel transactions={filteredTransactions} referenceDate={referenceDate} />
          <UpcomingExpensesPanel transactions={filteredTransactions} referenceDate={referenceDate} />
        </div>
      </section>

      <ViewFiltersModal title="Filtros financeiros" open={isModalOpen} onClose={closeFilters} onApply={applyFilters} onClear={clearFilters}>
        <div className="grid grid-cols-1 gap-[0.75rem] md:grid-cols-2 xl:grid-cols-4">
          <label className="pms-field md:col-span-2">
            <span>Busca</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraftFilter("search", event.target.value)}
              placeholder="Categoria, fornecedor, descrição ou referência"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Tipo</span>
            <select
              value={draftFilters.type}
              onChange={(event) => updateDraftFilter("type", event.target.value as TransactionViewFilters["type"])}
              className={viewFiltersFieldClassName}
            >
              <option value="all">Todos</option>
              <option value="INCOME">{translateTransactionType("INCOME")}</option>
              <option value="EXPENSE">{translateTransactionType("EXPENSE")}</option>
              <option value="REFUND">{translateTransactionType("REFUND")}</option>
            </select>
          </label>

          <label className="pms-field">
            <span>Status</span>
            <select
              value={draftFilters.status}
              onChange={(event) => updateDraftFilter("status", event.target.value as TransactionViewFilters["status"])}
              className={viewFiltersFieldClassName}
            >
              <option value="all">Todos</option>
              <option value="PENDING">{translateTransactionStatus("PENDING")}</option>
              <option value="COMPLETED">{translateTransactionStatus("COMPLETED")}</option>
              <option value="FAILED">{translateTransactionStatus("FAILED")}</option>
              <option value="CANCELLED">{translateTransactionStatus("CANCELLED")}</option>
              <option value="REFUNDED">{translateTransactionStatus("REFUNDED")}</option>
            </select>
          </label>

          <label className="pms-field">
            <span>Situação</span>
            <select
              value={draftFilters.settlement}
              onChange={(event) => updateDraftFilter("settlement", event.target.value as TransactionViewFilters["settlement"])}
              className={viewFiltersFieldClassName}
            >
              <option value="all">Todas</option>
              <option value="paid">Baixadas</option>
              <option value="open">Em aberto</option>
              <option value="overdue">Vencidas</option>
              <option value="due_soon">Vencem em 7 dias</option>
            </select>
          </label>

          <label className="pms-field">
            <span>Centro de custo</span>
            <input
              value={draftFilters.costCenter}
              onChange={(event) => updateDraftFilter("costCenter", event.target.value)}
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Metodo</span>
            <input
              value={draftFilters.paymentMethod}
              onChange={(event) => updateDraftFilter("paymentMethod", event.target.value)}
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Data inicial</span>
            <input
              type="date"
              value={draftFilters.dateFrom}
              onChange={(event) => updateDraftFilter("dateFrom", event.target.value)}
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Data final</span>
            <input
              type="date"
              value={draftFilters.dateTo}
              onChange={(event) => updateDraftFilter("dateTo", event.target.value)}
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Valor mínimo</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draftFilters.minAmount}
              onChange={(event) => updateDraftFilter("minAmount", event.target.value)}
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Valor máximo</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={draftFilters.maxAmount}
              onChange={(event) => updateDraftFilter("maxAmount", event.target.value)}
              className={viewFiltersFieldClassName}
            />
          </label>
        </div>
      </ViewFiltersModal>
    </section>
  );
}
