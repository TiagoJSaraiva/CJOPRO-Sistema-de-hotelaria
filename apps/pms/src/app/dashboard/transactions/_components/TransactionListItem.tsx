"use client";

import Link from "next/link";
import type { AdminFinancialTransaction } from "@hotel/shared";
import { isFinancialTransactionOverdue, translateTransactionStatus, translateTransactionType } from "@hotel/shared";
import { deleteTransactionAction, updateTransactionAction } from "../actions";

type TransactionListItemProps = {
  transaction: AdminFinancialTransaction;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

const statusClassNames: Record<AdminFinancialTransaction["status"], string> = {
  PENDING: "border-[#f5c56e] bg-[#fff8e8] text-[#8a5a00]",
  COMPLETED: "border-[#93d6b5] bg-[#effaf4] text-[#176c43]",
  FAILED: "border-[#f2a2a2] bg-[#fff2f2] text-[#a12b2b]",
  CANCELLED: "border-[#d2d6db] bg-[#f4f6f8] text-[#52606d]",
  REFUNDED: "border-[#9cc9ff] bg-[#eef6ff] text-[#1b5fa7]"
};

const typeClassNames: Record<AdminFinancialTransaction["type"], string> = {
  INCOME: "border-[#93d6b5] bg-[#f0fbf5] text-[#166534]",
  EXPENSE: "border-[#f3b2b2] bg-[#fff4f4] text-[#b42318]",
  REFUND: "border-[#9cc9ff] bg-[#eff7ff] text-[#155b9f]"
};

function formatMoney(amount: number, currency: string): string {
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
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function toDateTimeLocalValue(value: string | null | undefined): string {
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
}

function getSignedAmountLabel(transaction: AdminFinancialTransaction): string {
  const prefix = transaction.type === "INCOME" ? "+" : "-";
  return `${prefix}${formatMoney(transaction.amount, transaction.currency)}`;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[#697586]">{label}</span>
      <strong className="mt-[0.2rem] block truncate text-[0.92rem] font-semibold text-[#202939]">{value}</strong>
    </div>
  );
}

function TransactionDataPreview({ transaction }: { transaction: AdminFinancialTransaction }) {
  return (
    <div className="mt-4 grid gap-3 border-t border-[#e5e7eb] pt-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <DetailItem label="Fornecedor/favorecido" value={transaction.counterparty || "-"} />
        <DetailItem label="Centro de custo" value={transaction.cost_center || "-"} />
        <DetailItem label="Metodo" value={transaction.payment_method || "-"} />
        <DetailItem label="Referencia" value={transaction.reference_code || "-"} />
        <DetailItem label="Reserva" value={transaction.reservation_id || "-"} />
        <DetailItem label="Estadia" value={transaction.stay_id || "-"} />
        <DetailItem label="Criado em" value={formatDateTime(transaction.created_at)} />
        <DetailItem label="Atualizado em" value={formatDateTime(transaction.updated_at)} />
      </div>

      <div className="rounded-lg border border-[#e4e7ec] bg-[#f8fafc] p-3 text-[0.93rem] text-[#364152]">
        {transaction.description || "Sem descricao operacional cadastrada."}
      </div>
    </div>
  );
}

function TransactionEditForm({ transaction }: { transaction: AdminFinancialTransaction }) {
  return (
    <form action={updateTransactionAction} className="mt-4 grid gap-3 border-t border-[#e5e7eb] pt-4">
      <input type="hidden" name="id" value={transaction.id} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <label className="pms-field">
          <span>Tipo</span>
          <select name="type" defaultValue={transaction.type} className="pms-field-input">
            <option value="INCOME">{translateTransactionType("INCOME")}</option>
            <option value="EXPENSE">{translateTransactionType("EXPENSE")}</option>
            <option value="REFUND">{translateTransactionType("REFUND")}</option>
          </select>
        </label>

        <label className="pms-field lg:col-span-2">
          <span>Categoria</span>
          <input name="category" defaultValue={transaction.category} required className="pms-field-input" />
        </label>

        <label className="pms-field">
          <span>Status</span>
          <select name="status" defaultValue={transaction.status} className="pms-field-input">
            <option value="PENDING">{translateTransactionStatus("PENDING")}</option>
            <option value="COMPLETED">{translateTransactionStatus("COMPLETED")}</option>
            <option value="FAILED">{translateTransactionStatus("FAILED")}</option>
            <option value="CANCELLED">{translateTransactionStatus("CANCELLED")}</option>
            <option value="REFUNDED">{translateTransactionStatus("REFUNDED")}</option>
          </select>
        </label>

        <label className="pms-field">
          <span>Valor</span>
          <input name="amount" type="number" min={0} step="0.01" defaultValue={transaction.amount} required className="pms-field-input" />
        </label>

        <label className="pms-field">
          <span>Moeda</span>
          <input name="currency" defaultValue={transaction.currency} required className="pms-field-input" />
        </label>

        <label className="pms-field">
          <span>Vencimento</span>
          <input name="due_date" type="date" defaultValue={transaction.due_date || ""} className="pms-field-input" />
        </label>

        <label className="pms-field">
          <span>Pago em</span>
          <input name="paid_at" type="datetime-local" defaultValue={toDateTimeLocalValue(transaction.paid_at)} className="pms-field-input" />
        </label>

        <label className="pms-field">
          <span>Fornecedor/favorecido</span>
          <input name="counterparty" defaultValue={transaction.counterparty || ""} className="pms-field-input" />
        </label>

        <label className="pms-field">
          <span>Centro de custo</span>
          <input name="cost_center" defaultValue={transaction.cost_center || ""} className="pms-field-input" />
        </label>

        <label className="pms-field">
          <span>Metodo</span>
          <input name="payment_method" defaultValue={transaction.payment_method || ""} className="pms-field-input" />
        </label>

        <label className="pms-field">
          <span>Referencia</span>
          <input name="reference_code" defaultValue={transaction.reference_code || ""} className="pms-field-input" />
        </label>

        <label className="pms-field lg:col-span-2">
          <span>Reserva vinculada</span>
          <input name="reservation_id" defaultValue={transaction.reservation_id || ""} className="pms-field-input" />
        </label>

        <label className="pms-field lg:col-span-2">
          <span>Estadia vinculada</span>
          <input name="stay_id" defaultValue={transaction.stay_id || ""} className="pms-field-input" />
        </label>

        <label className="pms-field lg:col-span-4">
          <span>Descricao</span>
          <textarea name="description" defaultValue={transaction.description || ""} rows={3} className="pms-field-input resize-y" />
        </label>
      </div>

      <button type="submit" className="justify-self-start rounded-lg border border-[#14564c] bg-[#1b7a6c] px-[0.85rem] py-[0.6rem] font-semibold text-white">
        Salvar lançamento
      </button>
    </form>
  );
}

export function TransactionListItem({ transaction, canRead, canUpdate, canDelete, isViewing, isEditing }: TransactionListItemProps) {
  const viewHref = `/dashboard/transactions/view?transactionId=${transaction.id}&mode=view`;
  const editHref = `/dashboard/transactions/view?transactionId=${transaction.id}&mode=edit`;
  const overdue = isFinancialTransactionOverdue(transaction);

  return (
    <article className="rounded-lg border border-[#d9dfe7] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_150px_150px_170px] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-[0.55rem] py-[0.2rem] text-[0.76rem] font-semibold ${typeClassNames[transaction.type]}`}>
              {translateTransactionType(transaction.type)}
            </span>
            <span className={`rounded-full border px-[0.55rem] py-[0.2rem] text-[0.76rem] font-semibold ${statusClassNames[transaction.status]}`}>
              {translateTransactionStatus(transaction.status)}
            </span>
            {overdue ? (
              <span className="rounded-full border border-[#e67e22] bg-[#fff3e6] px-[0.55rem] py-[0.2rem] text-[0.76rem] font-semibold text-[#9a4b00]">
                Vencido
              </span>
            ) : null}
          </div>

          <h3 className="mb-[0.2rem] mt-3 truncate text-[1rem] font-semibold text-[#121926]">{transaction.category}</h3>
          <p className="m-0 truncate text-[0.9rem] text-[#52606d]">
            {transaction.counterparty || "Sem fornecedor"} {transaction.reference_code ? `- ${transaction.reference_code}` : ""}
          </p>
        </div>

        <div>
          <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[#697586]">Valor</span>
          <strong className={`mt-[0.2rem] block text-[1rem] ${transaction.type === "INCOME" ? "text-[#157347]" : "text-[#b42318]"}`}>
            {getSignedAmountLabel(transaction)}
          </strong>
        </div>

        <div>
          <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.04em] text-[#697586]">Vencimento</span>
          <strong className="mt-[0.2rem] block text-[0.95rem] text-[#202939]">{formatDate(transaction.due_date)}</strong>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {canRead ? (
            <Link href={viewHref} scroll={false} className={`rounded-lg border px-[0.65rem] py-[0.45rem] no-underline ${isViewing ? "border-[#2d6cdf] bg-[#e9f0ff] text-[#1b4db3]" : "border-[#d2d6db] bg-white text-[#344054]"}`}>
              Ver
            </Link>
          ) : null}

          {canUpdate ? (
            <Link href={editHref} scroll={false} className={`rounded-lg border px-[0.65rem] py-[0.45rem] no-underline ${isEditing ? "border-[#0f766e] bg-[#ddf5f2] text-[#0a5f58]" : "border-[#d2d6db] bg-white text-[#344054]"}`}>
              Editar
            </Link>
          ) : null}

          {canDelete ? (
            <form action={deleteTransactionAction}>
              <input type="hidden" name="id" value={transaction.id} />
              <button type="submit" className="rounded-lg border border-[#f2b8b5] bg-white px-[0.65rem] py-[0.45rem] text-[#b42318]">
                Excluir
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {isViewing ? <TransactionDataPreview transaction={transaction} /> : null}
      {isEditing ? <TransactionEditForm transaction={transaction} /> : null}
    </article>
  );
}
