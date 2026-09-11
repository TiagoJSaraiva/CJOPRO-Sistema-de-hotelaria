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
  consumptionQuantities,
  canManage,
  canReceive,
}: {
  stayId: string;
  accountVersion: number;
  currency: string;
  payers: Payer[];
  debitEntries: AdminStayFolioEntry[];
  consumptionQuantities: Record<string, number>;
  canManage: boolean;
  canReceive: boolean;
}) {
  const money = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
      value,
    );
  const [allocations, setAllocations] = useState<
    Record<string, Record<string, { amount: string; quantity: string }>>
  >(() =>
    Object.fromEntries(
      debitEntries.map((entry) => [
        entry.id,
        Object.fromEntries(
          payers.map((payer, index) => [
            payer.id,
            {
              amount: index === 0 ? String(entry.amount) : "",
              quantity:
                index === 0 && entry.kind === "consumption_charge"
                  ? String(
                      consumptionQuantities[entry.consumption_order_id || ""] ||
                        "",
                    )
                  : "",
            },
          ]),
        ),
      ]),
    ),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function updateAllocation(
    entryId: string,
    payerId: string,
    field: "amount" | "quantity",
    value: string,
  ) {
    setAllocations((current) => {
      const previous = current[entryId]?.[payerId] || {
        amount: "",
        quantity: "",
      };
      return {
        ...current,
        [entryId]: {
          ...current[entryId],
          [payerId]: { ...previous, [field]: value },
        },
      };
    });
  }
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
                allocations: debitEntries.flatMap((entry) =>
                  payers.flatMap((payer) => {
                    const allocation = allocations[entry.id]?.[payer.id];
                    const amount = Number(allocation?.amount || 0);
                    if (amount <= 0) return [];
                    const quantity = Number(allocation?.quantity || 0);
                    return [
                      {
                        folio_entry_id: entry.id,
                        payer_account_id: payer.id,
                        amount,
                        ...(quantity > 0 ? { quantity } : {}),
                      },
                    ];
                  }),
                ),
              });
              setMessage(result.error || "Responsabilidades atualizadas.");
            })
          }
        >
          <h3 className="m-0">Responsabilidade dos lançamentos</h3>
          {debitEntries.map((entry) => (
            <fieldset
              className="grid gap-2 rounded-lg border border-slate-200 p-3"
              key={entry.id}
            >
              <legend className="px-1 font-semibold">
                {entry.description} · {money(entry.amount)}
              </legend>
              {payers.map((payer) => (
                <div
                  className="grid gap-2 md:grid-cols-[1fr_10rem_10rem] md:items-end"
                  key={payer.id}
                >
                  <strong className="text-sm">{payer.display_name}</strong>
                  <label className="pms-field-label">
                    Valor
                    <input
                      className="pms-field-input"
                      type="number"
                      min="0"
                      max={entry.amount}
                      step="0.01"
                      value={allocations[entry.id]?.[payer.id]?.amount || ""}
                      onChange={(event) =>
                        updateAllocation(
                          entry.id,
                          payer.id,
                          "amount",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  {entry.kind === "consumption_charge" ? (
                    <label className="pms-field-label">
                      Quantidade
                      <input
                        className="pms-field-input"
                        type="number"
                        min="0"
                        step="0.001"
                        value={
                          allocations[entry.id]?.[payer.id]?.quantity || ""
                        }
                        onChange={(event) =>
                          updateAllocation(
                            entry.id,
                            payer.id,
                            "quantity",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  ) : null}
                </div>
              ))}
            </fieldset>
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
