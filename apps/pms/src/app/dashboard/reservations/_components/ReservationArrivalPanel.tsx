"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReservationArrivalSummary } from "@hotel/shared";
import {
  PanelSection,
  PaymentSummaryCard,
  formatMoney,
} from "./OperationalPanelPrimitives";

type GuaranteeMethod =
  "pix" | "cash" | "credit_card" | "debit_card" | "bank_transfer";

const METHOD_LABELS: Record<GuaranteeMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  bank_transfer: "Transferência bancária",
};

function guaranteePolicyLabel(value: string | null): string {
  if (!value) return "Sem exigência definida";
  return (
    {
      first_night: "Primeira diária",
      fixed: "Valor fixo",
      percentage: "Percentual da hospedagem",
      none: "Sem sinal obrigatório",
    }[value] || "Sem exigência definida"
  );
}

function localSiteHost(value: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function ReservationArrivalPanel({
  reservationId,
  canManageGuarantees,
  canManagePrearrival,
  publicSiteUrl,
  cashSession,
  onGuaranteeRegistered,
}: {
  reservationId: string;
  canManageGuarantees: boolean;
  canManagePrearrival: boolean;
  publicSiteUrl: string;
  cashSession: { id: string; registerName: string } | null;
  onGuaranteeRegistered?: () => void;
}) {
  const [data, setData] = useState<ReservationArrivalSummary>();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<GuaranteeMethod>("pix");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState("");
  const key = useRef<string | null>(null);
  const busy = useRef(false);
  const endpoint = `/api/reservation-operations/${reservationId}`;
  const reload = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.message || "Falha ao consultar chegada.");
    setData(result.arrival);
  }, [endpoint]);
  useEffect(() => {
    void reload().catch((error: Error) => setMessage(error.message));
  }, [reload]);

  const guaranteeRemaining = data
    ? Math.max(0, data.guarantee_required - data.guarantee_received)
    : 0;
  const amountToRecord =
    amount || (guaranteeRemaining > 0 ? guaranteeRemaining.toFixed(2) : "");

  async function act(action: "guarantees" | "prearrival-links") {
    if (busy.current || !data) return;
    if (action === "guarantees" && method === "cash" && !cashSession) {
      setMessage(
        "Abra uma sessão de caixa para registrar recebimento em dinheiro.",
      );
      return;
    }
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      if (action === "guarantees") key.current ||= crypto.randomUUID();
      const response = await fetch(`${endpoint}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "guarantees"
            ? {
                expected_version: data.version,
                idempotency_key: key.current,
                tenders: [
                  {
                    method,
                    amount: Number(amountToRecord),
                    reference: reference || undefined,
                    ...(method === "cash"
                      ? { cash_session_id: cashSession?.id }
                      : {}),
                  },
                ],
              }
            : { expires_in_hours: 24 },
        ),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409 || response.status === 400)
          key.current = null;
        throw new Error(
          result.message || "Não foi possível concluir. Revise os dados.",
        );
      }
      if (action === "prearrival-links") {
        setLink(new URL(`/pre-chegada/${result.token}`, publicSiteUrl).href);
        setMessage(
          "Link criado e válido por 24 horas. O acesso anterior foi revogado.",
        );
      } else {
        key.current = null;
        setAmount("");
        setReference("");
        setMessage(
          `${formatMoney(Number(amountToRecord))} recebido por ${METHOD_LABELS[method]} e registrado como adiantamento.`,
        );
      }
      await reload();
      if (action === "guarantees") onGuaranteeRegistered?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na operação.");
      await reload().catch(() => undefined);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <PanelSection
      title="Chegada e adiantamento"
      description="Confira a ocupação, registre recebimentos confirmados e prepare os dados da chegada."
    >
      {data ? (
        <>
          <div data-usage-guide="arrival-occupancy" className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <PaymentSummaryCard
                label="Quantidade de hóspedes"
                value={String(data.guest_count)}
                detail="Todos os ocupantes"
              />
              <PaymentSummaryCard
                label="Total contratado"
                value={formatMoney(
                  data.accommodations.reduce(
                    (sum, item) =>
                      sum +
                      item.nights.reduce(
                        (nights, night) => nights + night.amount,
                        0,
                      ),
                    0,
                  ),
                )}
                detail={`${data.accommodations.length} acomodação(ões)`}
              />
            </div>
            {data.accommodations.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-[#e4e7ec] bg-[#f8fafc] p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <strong className="text-[#202939]">{item.room_type}</strong>
                  <span className="text-xs text-[#52606d]">
                    {item.checkin_date} → {item.checkout_date}
                  </span>
                </div>
                <p className="mb-1 mt-2 text-sm text-[#344054]">
                  {item.adults} adulto(s) · {item.children} criança(s)
                </p>
                <p className="m-0 text-xs text-[#52606d]">
                  {item.nights
                    .map(
                      (night) => `${night.date}: ${formatMoney(night.amount)}`,
                    )
                    .join(" · ")}
                </p>
              </article>
            ))}
          </div>

          <div
            data-usage-guide="arrival-guarantee"
            className="grid gap-3 border-t border-[#e4e7ec] pt-3"
          >
            <div>
              <h5 className="m-0 text-sm font-semibold text-[#202939]">
                Sinal / adiantamento
              </h5>
              <p className="mb-0 mt-1 text-xs text-[#52606d]">
                Política:{" "}
                {guaranteePolicyLabel(
                  data.accommodations[0]?.guarantee_type ?? null,
                )}
                . O adiantamento reduz o saldo da hospedagem; não é taxa extra.
                Multas seguem a política de cancelamento.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <PaymentSummaryCard
                label="Exigido"
                value={formatMoney(data.guarantee_required)}
                detail="Pela tarifa"
              />
              <PaymentSummaryCard
                label="Recebido"
                value={formatMoney(data.guarantee_received)}
                detail="Adiantamento"
                tone={data.guarantee_received > 0 ? "good" : "neutral"}
              />
              <div className="sm:col-span-2">
                <PaymentSummaryCard
                  label="Falta do sinal"
                  value={formatMoney(guaranteeRemaining)}
                  detail={
                    guaranteeRemaining === 0
                      ? "Exigência atendida"
                      : "Para atender à política"
                  }
                  tone={guaranteeRemaining === 0 ? "good" : "neutral"}
                />
              </div>
            </div>
            <p className="m-0 rounded-lg bg-[#f1f6f5] p-3 text-xs leading-relaxed text-[#344054]">
              Este controle registra dinheiro que o hotel já recebeu. Ele não
              envia cobrança Pix nem processa cartão. Antes do check-in, o
              adiantamento fica na reserva; na chegada, entra na conta da
              estadia uma única vez.
            </p>
            {canManageGuarantees && guaranteeRemaining > 0 ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void act("guarantees");
                }}
                className="grid gap-2 rounded-lg border border-[#e4e7ec] p-3"
              >
                <label className="pms-field">
                  <span>Meio de pagamento recebido</span>
                  <select
                    className="pms-field-input"
                    value={method}
                    onChange={(event) => {
                      setMethod(event.target.value as GuaranteeMethod);
                      key.current = null;
                    }}
                  >
                    <option value="pix">Pix</option>
                    <option value="cash" disabled={!cashSession}>
                      Dinheiro
                    </option>
                    <option value="credit_card">Cartão de crédito</option>
                    <option value="debit_card">Cartão de débito</option>
                    <option value="bank_transfer">
                      Transferência bancária
                    </option>
                  </select>
                </label>
                {method === "cash" && cashSession ? (
                  <p className="m-0 text-xs text-[#52606d]">
                    Será associado à sua sessão aberta:{" "}
                    {cashSession.registerName}.
                  </p>
                ) : null}
                {!cashSession ? (
                  <p className="m-0 text-xs text-[#8a3b12]">
                    Dinheiro exige uma sessão de caixa aberta por você; sem uma
                    sessão ativa, essa opção fica indisponível.
                  </p>
                ) : null}
                <label className="pms-field">
                  <span>Valor efetivamente recebido (R$)</span>
                  <input
                    className="pms-field-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={guaranteeRemaining.toFixed(2)}
                    required
                    value={amountToRecord}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      key.current = null;
                    }}
                  />
                </label>
                <label className="pms-field">
                  <span>Referência ou observação (opcional)</span>
                  <input
                    className="pms-field-input"
                    maxLength={120}
                    value={reference}
                    onChange={(event) => {
                      setReference(event.target.value);
                      key.current = null;
                    }}
                  />
                </label>
                <button
                  className="pms-button-primary justify-self-start"
                  disabled={pending || Number(amountToRecord) <= 0}
                >
                  {pending ? "Registrando…" : "Registrar adiantamento recebido"}
                </button>
              </form>
            ) : null}
          </div>

          {canManagePrearrival ? (
            <div
              data-usage-guide="arrival-prearrival"
              className="grid gap-2 border-t border-[#e4e7ec] pt-3"
            >
              <div>
                <h5 className="m-0 text-sm font-semibold text-[#202939]">
                  Pré-chegada
                </h5>
                <p className="mb-0 mt-1 text-xs text-[#52606d]">
                  {data.submission
                    ? `Recebida · chegada prevista ${data.submission.arrival_time || "não informada"}`
                    : "Ainda não enviada"}
                  {data.submission?.submitted_at
                    ? ` · ${new Date(data.submission.submitted_at).toLocaleString("pt-BR")}`
                    : ""}
                </p>
              </div>
              {data.guests.length ? (
                <ul className="m-0 grid gap-1 pl-5 text-sm text-[#344054]">
                  {data.guests.map((guest, index) => (
                    <li key={`${guest.role}-${index}`}>
                      {guest.role === "primary" ? "Titular" : "Acompanhante"}:{" "}
                      {guest.full_name}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="pms-button-primary"
                  disabled={pending}
                  onClick={() => void act("prearrival-links")}
                >
                  {link
                    ? "Gerar outro link (revoga o atual)"
                    : "Gerar link de pré-chegada"}
                </button>
                <button
                  type="button"
                  className="pms-button-secondary"
                  disabled={pending}
                  onClick={() => {
                    void reload().catch((error: Error) =>
                      setMessage(error.message),
                    );
                  }}
                >
                  Atualizar envio
                </button>
              </div>
              {link ? (
                <div className="grid gap-2 rounded-lg border border-[#cbdedb] bg-[#f4faf9] p-3">
                  <span className="break-all text-xs text-[#344054]">
                    {link}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="pms-button-secondary inline-flex items-center justify-center no-underline"
                    >
                      Abrir formulário público
                    </a>
                    <button
                      type="button"
                      className="pms-button-secondary"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(link)
                          .then(() => setMessage("Link copiado."))
                          .catch(() =>
                            setMessage("Não foi possível copiar o link."),
                          );
                      }}
                    >
                      Copiar endereço
                    </button>
                  </div>
                </div>
              ) : null}
              <p className="m-0 text-xs text-[#52606d]">
                O link vale 24 horas. Enviar os dados não confirma pedidos
                especiais nem faz check-in.
              </p>
              {localSiteHost(publicSiteUrl) ? (
                <p className="m-0 rounded-lg bg-[#fff9eb] p-3 text-xs text-[#7a4b00]">
                  Link local: mantenha o site público em execução com{" "}
                  <code>pnpm dev</code>. Endereços localhost abrem somente no
                  computador onde o site está rodando.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <p>Consultando preparação da chegada…</p>
      )}
      <p
        role="status"
        aria-live="polite"
        className="m-0 text-sm text-[#344054]"
      >
        {message}
      </p>
    </PanelSection>
  );
}
