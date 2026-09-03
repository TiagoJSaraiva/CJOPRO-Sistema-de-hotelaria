"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminMaintenanceCostItem,
  AdminMaintenanceFinanceListResponse,
  AdminMaintenanceRecovery,
} from "@hotel/shared";
import { ContextHelp } from "../../_components/ContextHelp";

type Props = {
  data: AdminMaintenanceFinanceListResponse;
  currentUserId: string;
  canApprove: boolean;
  canSettle: boolean;
};

function isCost(
  item: AdminMaintenanceCostItem | AdminMaintenanceRecovery,
): item is AdminMaintenanceCostItem {
  return "actual_amount" in item;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}

export function MaintenanceFinanceBoard({
  data,
  currentUserId,
  canApprove,
  canSettle,
}: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function action(
    item: AdminMaintenanceCostItem | AdminMaintenanceRecovery,
    operation: "approve" | "reject" | "settle" | "reverse",
    form?: HTMLFormElement,
  ) {
    setBusyId(item.id);
    setError(null);
    const target = isCost(item) ? "cost-items" : "recoveries";
    const formData = form ? new FormData(form) : null;
    const body =
      operation === "settle"
        ? {
            amount: Number(formData?.get("amount") || 0),
            method: String(formData?.get("method") || "manual"),
            note: String(formData?.get("note") || "") || undefined,
          }
        : operation === "reverse"
          ? { reason: String(formData?.get("reason") || "") }
          : {
              action: operation,
              reason: String(formData?.get("reason") || "") || undefined,
            };
    const endpoint =
      operation === "reverse"
        ? `finance/settlements/${String(formData?.get("settlement_id") || "")}/reverse`
        : `${target}/${item.id}/${operation === "settle" ? "settlements" : "transition"}`;
    const response = await fetch(`/api/maintenance/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    if (!response.ok)
      setError(payload.message || "Não foi possível concluir a operação.");
    else router.refresh();
    setBusyId(null);
  }

  if (!data.items.length)
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        Nenhum item financeiro nesta fila.
      </div>
    );

  return (
    <div className="space-y-4" aria-live="polite">
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
      {data.items.map((item) => {
        const cost = isCost(item);
        const principal = cost
          ? item.actual_amount || item.estimated_amount || 0
          : item.charge_amount;
        return (
          <article
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {cost ? "Custo" : "Recuperação"} ·{" "}
                  {item.occurrence_code || "Ocorrência"}
                </p>
                <h2 className="mt-1 font-semibold text-slate-900">
                  {cost ? item.description : item.justification}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Proposto por {item.proposer_name || "usuário interno"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-900">
                  {formatMoney(principal, item.currency)}
                </p>
                <p className="text-xs text-slate-500">
                  {item.approval_status} · {item.settlement_status}
                  <ContextHelp label="Aprovação e liquidação">
                    Propor, aprovar e liquidar são etapas separadas. O autor não
                    pode aprovar o próprio item; pagar ou receber exige a
                    permissão de liquidação.
                  </ContextHelp>
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <span>
                Liquidado: {formatMoney(item.settled_amount, item.currency)}
              </span>
              <span>
                Em aberto: {formatMoney(item.outstanding_amount, item.currency)}
              </span>
              <span>Vencimento: {item.due_date || "não informado"}</span>
            </div>
            {canApprove && item.approval_status === "submitted" ? (
              <form
                className="mt-4 flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void action(item, "reject", event.currentTarget);
                }}
              >
                <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
                  Justificativa para rejeição
                  <input
                    name="reason"
                    minLength={3}
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    busyId === item.id || item.created_by === currentUserId
                  }
                  onClick={() => void action(item, "approve")}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Aprovar
                </button>
                <button
                  disabled={busyId === item.id}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                >
                  Rejeitar
                </button>
              </form>
            ) : null}
            {canSettle &&
            ["open", "partially_settled"].includes(item.settlement_status) ? (
              <form
                className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void action(item, "settle", event.currentTarget);
                }}
              >
                <label className="text-sm">
                  Valor
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    max={item.outstanding_amount}
                    step="0.01"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  Método
                  <input
                    name="method"
                    required
                    defaultValue="manual"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  Observação
                  <input
                    name="note"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <button
                  disabled={busyId === item.id}
                  className="self-end rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {cost ? "Pagar" : "Receber"}
                </button>
              </form>
            ) : null}
            {canSettle &&
            item.settlements?.some(
              (settlement) => !settlement.reversal_of_id,
            ) ? (
              <form
                className="mt-3 flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void action(item, "reverse", event.currentTarget);
                }}
              >
                <label className="text-sm">
                  Liquidação
                  <select
                    name="settlement_id"
                    className="ml-2 rounded-lg border border-slate-300 px-2 py-2"
                  >
                    {item.settlements
                      .filter(
                        (settlement) =>
                          !settlement.reversal_of_id &&
                          !item.settlements?.some(
                            (candidate) =>
                              candidate.reversal_of_id === settlement.id,
                          ),
                      )
                      .map((settlement) => (
                        <option key={settlement.id} value={settlement.id}>
                          {formatMoney(settlement.amount, item.currency)}
                        </option>
                      ))}
                  </select>
                </label>
                <input
                  name="reason"
                  required
                  minLength={3}
                  placeholder="Motivo do estorno"
                  className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  disabled={busyId === item.id}
                  className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-medium text-amber-800 disabled:opacity-50"
                >
                  Estornar
                </button>
              </form>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
