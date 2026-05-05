"use client";

import type { AdminFinancialTransaction } from "@hotel/shared";
import { translateTransactionStatus, translateTransactionType } from "@hotel/shared";
import { deleteTransactionAction, updateTransactionAction } from "../actions";
import { DashboardEntityActionButtons } from "../../_components/DashboardEntityActionButtons";
import { DashboardEntityListItemFrame } from "../../_components/DashboardEntityListItemFrame";

type TransactionListItemProps = {
  transaction: AdminFinancialTransaction;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

function TransactionDataPreview({ transaction }: { transaction: AdminFinancialTransaction }) {
  const createdAt = transaction.created_at ? new Date(transaction.created_at).toLocaleString("pt-BR") : "-";
  const updatedAt = transaction.updated_at ? new Date(transaction.updated_at).toLocaleString("pt-BR") : "-";
  const amountLabel = `${transaction.currency} ${transaction.amount.toFixed(2)}`;

  return (
    <div className="mt-[0.85rem] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[0.75rem]">
      <div>
        <strong>Tipo:</strong>
        <p className="m-0 mt-[0.2rem]">{translateTransactionType(transaction.type)}</p>
      </div>
      <div>
        <strong>Categoria:</strong>
        <p className="m-0 mt-[0.2rem]">{transaction.category}</p>
      </div>
      <div>
        <strong>Valor:</strong>
        <p className="m-0 mt-[0.2rem]">{amountLabel}</p>
      </div>
      <div>
        <strong>Status:</strong>
        <p className="m-0 mt-[0.2rem]">{translateTransactionStatus(transaction.status)}</p>
      </div>
      <div>
        <strong>Descricao:</strong>
        <p className="m-0 mt-[0.2rem]">{transaction.description || "-"}</p>
      </div>
      <div>
        <strong>Criado em:</strong>
        <p className="m-0 mt-[0.2rem]">{createdAt}</p>
      </div>
      <div>
        <strong>Atualizado em:</strong>
        <p className="m-0 mt-[0.2rem]">{updatedAt}</p>
      </div>
    </div>
  );
}

function TransactionEditForm({ transaction }: { transaction: AdminFinancialTransaction }) {
  return (
    <form action={updateTransactionAction} className="mt-[0.85rem] grid gap-[0.65rem]">
      <input type="hidden" name="id" value={transaction.id} />

      <div className="pms-field">
        <label htmlFor={`transaction-type-${transaction.id}`}>Tipo</label>
        <select id={`transaction-type-${transaction.id}`} name="type" defaultValue={transaction.type} className="pms-field-input">
          <option value="INCOME">{translateTransactionType("INCOME")}</option>
          <option value="EXPENSE">{translateTransactionType("EXPENSE")}</option>
          <option value="REFUND">{translateTransactionType("REFUND")}</option>
        </select>
      </div>

      <div className="pms-field">
        <label htmlFor={`transaction-category-${transaction.id}`}>Categoria</label>
        <input id={`transaction-category-${transaction.id}`} name="category" defaultValue={transaction.category} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`transaction-amount-${transaction.id}`}>Valor</label>
        <input id={`transaction-amount-${transaction.id}`} name="amount" type="number" min={0} step="0.01" defaultValue={transaction.amount} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`transaction-currency-${transaction.id}`}>Moeda</label>
        <input id={`transaction-currency-${transaction.id}`} name="currency" defaultValue={transaction.currency} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`transaction-status-${transaction.id}`}>Status</label>
        <select id={`transaction-status-${transaction.id}`} name="status" defaultValue={transaction.status} className="pms-field-input">
          <option value="PENDING">{translateTransactionStatus("PENDING")}</option>
          <option value="COMPLETED">{translateTransactionStatus("COMPLETED")}</option>
          <option value="FAILED">{translateTransactionStatus("FAILED")}</option>
          <option value="CANCELLED">{translateTransactionStatus("CANCELLED")}</option>
          <option value="REFUNDED">{translateTransactionStatus("REFUNDED")}</option>
        </select>
      </div>

      <div className="pms-field">
        <label htmlFor={`transaction-description-${transaction.id}`}>Descricao</label>
        <input id={`transaction-description-${transaction.id}`} name="description" defaultValue={transaction.description || ""} className="pms-field-input" />
      </div>

      <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
        Salvar alteracoes
      </button>
    </form>
  );
}

export function TransactionListItem({ transaction, canRead, canUpdate, canDelete, isViewing, isEditing }: TransactionListItemProps) {
  const viewHref = `/dashboard/transactions/view?transactionId=${transaction.id}&mode=view`;
  const editHref = `/dashboard/transactions/view?transactionId=${transaction.id}&mode=edit`;

  return (
    <DashboardEntityListItemFrame
      title={transaction.category}
      subtitle={`${translateTransactionType(transaction.type)} | ${transaction.currency} ${transaction.amount.toFixed(2)} | ${translateTransactionStatus(transaction.status)}`}
      actions={
        <DashboardEntityActionButtons
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={isViewing}
          isEditing={isEditing}
          viewHref={viewHref}
          editHref={editHref}
          deleteId={transaction.id}
          deleteAction={deleteTransactionAction}
        />
      }
    >
      {isViewing ? <TransactionDataPreview transaction={transaction} /> : null}
      {isEditing ? <TransactionEditForm transaction={transaction} /> : null}
    </DashboardEntityListItemFrame>
  );
}
