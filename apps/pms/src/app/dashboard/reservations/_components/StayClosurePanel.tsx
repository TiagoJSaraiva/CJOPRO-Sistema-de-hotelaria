"use client";

import { useRef, useState } from "react";
import { PanelSection, formatMoney } from "./OperationalPanelPrimitives";

type ClosureAction = "cancel" | "no_show";
type ClosureView = {
  cancel_penalty: number;
  no_show_penalty: number;
  balance: number;
};

const ACTION_LABEL: Record<ClosureAction, string> = {
  cancel: "cancelamento",
  no_show: "no-show",
};
const MIN_REASON = 3;
const buttonClass =
  "cursor-pointer rounded-lg border border-[#d0d5dd] bg-white px-3 py-2 text-sm font-semibold text-[#344054] disabled:cursor-not-allowed disabled:opacity-60";

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <p className="m-0 flex justify-between gap-3 text-sm">
      <span>{label}</span>
      <strong>{formatMoney(value)}</strong>
    </p>
  );
}

export function StayClosurePanel({
  stayStatus,
  reservationId,
  canCancel,
  cancelBlockReason,
  canNoShow,
  noShowBlockReason,
  canSettle,
  cashSession,
  disabled,
  closure,
  onClose,
  onSettled,
}: {
  stayStatus: string;
  reservationId: string;
  canCancel: boolean;
  cancelBlockReason: string | null;
  canNoShow: boolean;
  noShowBlockReason: string | null;
  canSettle: boolean;
  cashSession: { id: string; registerName: string } | null;
  disabled: boolean;
  closure?: ClosureView;
  onClose: (action: ClosureAction, reason: string) => void;
  onSettled: () => void;
}) {
  const [action, setAction] = useState<ClosureAction | null>(null);
  const [reason, setReason] = useState("");

  if (stayStatus !== "confirmed") {
    if (stayStatus !== "canceled" && stayStatus !== "no_show") return null;
    if (!closure?.balance) return null;
    return (
      <ClosureSettlement
        key={closure.balance}
        reservationId={reservationId}
        balance={closure.balance}
        canSettle={canSettle}
        cashSession={cashSession}
        onSettled={onSettled}
      />
    );
  }

  const penalty =
    action === "cancel"
      ? (closure?.cancel_penalty ?? 0)
      : (closure?.no_show_penalty ?? 0);
  const remaining = (closure?.balance ?? 0) - penalty;
  const trimmed = reason.trim();
  const blockReasons = [
    canCancel ? null : cancelBlockReason,
    canNoShow ? null : noShowBlockReason,
  ].filter(Boolean);

  return (
    <div className="grid gap-2" data-usage-guide="stay-closure">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || !canNoShow}
          title={noShowBlockReason || ""}
          onClick={() => setAction("no_show")}
        >
          No-show
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || !canCancel}
          title={cancelBlockReason || ""}
          onClick={() => setAction("cancel")}
        >
          Cancelar
        </button>
      </div>
      {blockReasons.map((text) => (
        <p className="m-0 text-xs text-[#52606d]" key={text}>
          {text}
        </p>
      ))}
      {action ? (
        <div
          role="group"
          aria-label={`Confirmar ${ACTION_LABEL[action]}`}
          className="grid gap-2 rounded-lg border border-[#e4e7ec] p-3"
        >
          <p className="m-0 text-sm">
            Encerra a estadia e a reserva e libera o quarto.
          </p>
          <SummaryLine label="Multa do plano" value={penalty} />
          <SummaryLine
            label="Adiantamento recebido"
            value={closure?.balance ?? 0}
          />
          {remaining > 0 ? (
            <SummaryLine label="A devolver" value={remaining} />
          ) : null}
          {remaining < 0 ? (
            <SummaryLine label="A receber" value={-remaining} />
          ) : null}
          <label className="pms-field">
            <span>Motivo</span>
            <textarea
              className="pms-field-input"
              maxLength={500}
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="pms-button-primary"
              disabled={disabled || trimmed.length < MIN_REASON}
              onClick={() => onClose(action, trimmed)}
            >
              Confirmar {ACTION_LABEL[action]}
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setAction(null);
                setReason("");
              }}
            >
              Voltar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ClosureSettlement({
  reservationId,
  balance,
  canSettle,
  cashSession,
  onSettled,
}: {
  reservationId: string;
  balance: number;
  canSettle: boolean;
  cashSession: { id: string; registerName: string } | null;
  onSettled: () => void;
}) {
  const refund = balance > 0;
  const owed = Math.abs(balance);
  const [method, setMethod] = useState("pix");
  const [amount, setAmount] = useState(owed.toFixed(2));
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  // Uma falha de rede não diz se o valor foi registrado. A mesma chave impede registrar duas vezes.
  const key = useRef<string | null>(null);

  if (!canSettle)
    return (
      <p className="m-0 text-sm">
        {refund ? "Saldo a devolver" : "Multa a receber"}:{" "}
        <strong>{formatMoney(owed)}</strong>. Fale com quem registra
        adiantamentos.
      </p>
    );

  async function submit() {
    setPending(true);
    setMessage("");
    key.current ||= crypto.randomUUID();
    try {
      const response = await fetch(
        `/api/reservation-operations/${reservationId}/settlement`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            amount: Number(amount),
            method,
            reference: reference.trim() || undefined,
            idempotency_key: key.current,
            ...(method === "cash" ? { cash_session_id: cashSession?.id } : {}),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 400 || response.status === 409)
          key.current = null;
        throw new Error(result.message || "Não foi possível registrar.");
      }
      key.current = null;
      onSettled();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível registrar.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <PanelSection title={refund ? "Devolver crédito" : "Receber multa"}>
      <div className="grid gap-2" data-usage-guide="stay-closure">
        <p className="m-0 text-sm">
          {refund
            ? "A reserva foi encerrada e o hotel ainda deve este valor ao hóspede."
            : "A reserva foi encerrada e o adiantamento não cobriu a multa do plano."}{" "}
          <strong>{formatMoney(owed)}</strong>
        </p>
        <label className="pms-field">
          <span>Meio de pagamento</span>
          <select
            className="pms-field-input"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            <option value="pix">Pix</option>
            <option value="cash" disabled={!cashSession}>
              Dinheiro
            </option>
            <option value="credit_card">Cartão de crédito</option>
            <option value="debit_card">Cartão de débito</option>
            <option value="bank_transfer">Transferência bancária</option>
          </select>
        </label>
        {!cashSession ? (
          <p className="m-0 text-xs text-[#52606d]">
            Dinheiro exige uma sessão de caixa aberta por você.
          </p>
        ) : null}
        <label className="pms-field">
          <span>Valor (R$)</span>
          <input
            className="pms-field-input"
            type="number"
            min="0.01"
            max={owed.toFixed(2)}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label className="pms-field">
          <span>Referência (opcional)</span>
          <input
            className="pms-field-input"
            maxLength={120}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="pms-button-primary justify-self-start"
          disabled={pending || Number(amount) <= 0 || Number(amount) > owed}
          onClick={() => void submit()}
        >
          {refund ? "Registrar devolução" : "Registrar recebimento"}
        </button>
        {message ? (
          <p className="m-0 text-sm text-[#8a3b12]" role="alert">
            {message}
          </p>
        ) : null}
      </div>
    </PanelSection>
  );
}
