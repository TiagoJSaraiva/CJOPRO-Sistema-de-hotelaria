"use client";

import { useState, useTransition } from "react";
import type { AdminStayFolioEntry } from "@hotel/shared";
import { allocatePayersAction, payPayerAction } from "../payerActions";

type Payer = {
  id: string;
  kind: string;
  display_name: string;
  debit_total: number;
  credit_total: number;
  balance: number;
};
export function PayerAccountsPanel({
  stayId,
  accountVersion,
  currency,
  payers,
  debitEntries,
  canManage,
  canReceive,
}: {
  stayId: string;
  accountVersion: number;
  currency: string;
  payers: Payer[];
  debitEntries: AdminStayFolioEntry[];
  canManage: boolean;
  canReceive: boolean;
}) {
  const money = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
      value,
    );
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      debitEntries.map((entry) => [entry.id, payers[0]?.id || ""]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <section
      className="pms-surface-card grid gap-3"
      data-usage-guide="stay-payer-accounts"
    >
      <div>
        <h2 className="m-0">Subcontas por pagador</h2>
        <p className="mb-0 text-sm text-slate-600">
          Cada lançamento deve pertencer integralmente a um pagador; pagamentos
          reduzem somente a subconta escolhida.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {payers.map((payer) => (
          <article
            className="rounded-xl border border-slate-200 p-3"
            key={payer.id}
          >
            <strong>{payer.display_name}</strong>
            <p className="mb-0 text-sm">
              {payer.kind === "company"
                ? "Empresa"
                : payer.kind === "companion"
                  ? "Acompanhante"
                  : "Hóspede principal"}
            </p>
            <p className="mb-0">
              Saldo: <strong>{money(payer.balance)}</strong>
            </p>
            {canReceive && payer.balance > 0 ? (
              <form
                className="mt-3 grid gap-2"
                action={(data) =>
                  startTransition(async () => {
                    const result = await payPayerAction(stayId, {
                      payer_account_id: payer.id,
                      expected_account_version: accountVersion,
                      idempotency_key: crypto.randomUUID(),
                      tenders: [
                        {
                          payment_method: String(data.get("method")),
                          amount: Number(data.get("amount")),
                          reference_code:
                            String(data.get("reference") || "") || undefined,
                        },
                      ],
                    });
                    setMessage(
                      result.error || "Pagamento atribuído à subconta.",
                    );
                  })
                }
              >
                <label className="pms-field-label">
                  Valor
                  <input
                    className="pms-field-input"
                    name="amount"
                    type="number"
                    min="0.01"
                    max={payer.balance}
                    step="0.01"
                    required
                  />
                </label>
                <label className="pms-field-label">
                  Meio
                  <select className="pms-field-input" name="method">
                    <option value="pix">PIX</option>
                    <option value="cash">Dinheiro</option>
                    <option value="credit_card">Crédito</option>
                    <option value="debit_card">Débito</option>
                    <option value="bank_transfer">Transferência</option>
                  </select>
                </label>
                <input
                  className="pms-field-input"
                  name="reference"
                  placeholder="Referência opcional"
                />
                <button className="pms-button-secondary" disabled={pending}>
                  Registrar pagamento
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
      {canManage && debitEntries.length > 0 && payers.length > 1 ? (
        <form
          className="grid gap-3"
          action={() =>
            startTransition(async () => {
              const result = await allocatePayersAction(stayId, {
                expected_account_version: accountVersion,
                allocations: debitEntries.map((entry) => ({
                  folio_entry_id: entry.id,
                  payer_account_id: assignments[entry.id]!,
                  amount: entry.amount,
                })),
              });
              setMessage(result.error || "Responsabilidades atualizadas.");
            })
          }
        >
          <h3 className="m-0">Responsabilidade dos lançamentos</h3>
          {debitEntries.map((entry) => (
            <label
              className="grid gap-1 md:grid-cols-[1fr_16rem] md:items-center"
              key={entry.id}
            >
              <span>
                {entry.description} · {money(entry.amount)}
              </span>
              <select
                className="pms-field-input"
                value={assignments[entry.id]}
                onChange={(event) =>
                  setAssignments((current) => ({
                    ...current,
                    [entry.id]: event.target.value,
                  }))
                }
              >
                {payers.map((payer) => (
                  <option key={payer.id} value={payer.id}>
                    {payer.display_name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button className="pms-button-primary" disabled={pending}>
            Confirmar distribuição integral
          </button>
        </form>
      ) : null}
      {message ? (
        <p role="status" className="pms-status-info">
          {message}
        </p>
      ) : null}
    </section>
  );
}
