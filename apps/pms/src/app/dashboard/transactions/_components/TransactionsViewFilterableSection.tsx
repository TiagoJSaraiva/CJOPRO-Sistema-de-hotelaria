"use client";

import { useMemo } from "react";
import type { AdminFinancialTransaction } from "@hotel/shared";
import { translateTransactionStatus, translateTransactionType } from "@hotel/shared";
import {
  DEFAULT_TRANSACTION_VIEW_FILTERS,
  applyTransactionViewFilters,
  countAppliedTransactionFilters,
  type TransactionViewFilters
} from "./transactionViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";
import { TransactionListItem } from "./TransactionListItem";

type TransactionsViewFilterableSectionProps = {
  transactions: AdminFinancialTransaction[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  activeTransactionId: string;
  mode: "view" | "edit";
  children?: React.ReactNode;
};

export function TransactionsViewFilterableSection({
  transactions,
  canRead,
  canUpdate,
  canDelete,
  activeTransactionId,
  mode,
  children
}: TransactionsViewFilterableSectionProps) {
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

  const appliedFilterCount = countAppliedTransactionFilters(appliedFilters);
  const filteredTransactions = useMemo(
    () => applyTransactionViewFilters(transactions, appliedFilters),
    [transactions, appliedFilters]
  );

  return (
    <EntityViewFilterableSection
      appliedFilterCount={appliedFilterCount}
      totalCount={transactions.length}
      filteredItems={filteredTransactions}
      itemLabelPlural="transacoes"
      filtersTitle="Filtros de transacoes"
      isModalOpen={isModalOpen}
      onOpenFilters={openFilters}
      onCloseFilters={closeFilters}
      onApplyFilters={applyFilters}
      onClearFilters={clearFilters}
      emptyMessage="Nenhuma transacao cadastrada ate o momento."
      filteredEmptyMessage="Nenhuma transacao corresponde aos filtros aplicados."
      getItemKey={(transaction) => transaction.id}
      renderItem={(transaction) => (
        <TransactionListItem
          transaction={transaction}
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={activeTransactionId === transaction.id && mode === "view"}
          isEditing={activeTransactionId === transaction.id && mode === "edit"}
        />
      )}
      filters={
        <div className="grid grid-cols-1 gap-[0.75rem] md:grid-cols-2 xl:grid-cols-4">
          <label className="pms-field">
            <span>Categoria ou descricao</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraftFilter("search", event.target.value)}
              placeholder="Ex.: hospedagem, reembolso"
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
            <span>Valor minimo</span>
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
            <span>Valor maximo</span>
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
      }
    >
      {children}
    </EntityViewFilterableSection>
  );
}
