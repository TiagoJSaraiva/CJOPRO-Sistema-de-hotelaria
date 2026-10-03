"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReservationArrivalSummary } from "@hotel/shared";
import { PanelSection, formatMoney } from "./OperationalPanelPrimitives";

export function ReservationArrivalPanel({
  reservationId,
  canManageGuarantees,
  canManagePrearrival,
  publicSiteUrl,
}: {
  reservationId: string;
  canManageGuarantees: boolean;
  canManagePrearrival: boolean;
  publicSiteUrl: string;
}) {
  const [data, setData] = useState<ReservationArrivalSummary>();
  const [amount, setAmount] = useState("");
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
  async function act(action: "guarantees" | "prearrival-links") {
    if (busy.current || !data) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      key.current ||= crypto.randomUUID();
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
                    method: "pix",
                    amount: Number(amount),
                    reference: reference || undefined,
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
        setMessage("Link válido por 24 horas. O acesso anterior foi revogado.");
      } else {
        key.current = null;
        setAmount("");
        setMessage(
          "Sinal via PIX registrado. O crédito será transferido na chegada.",
        );
      }
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na operação.");
      await reload().catch(() => undefined);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <PanelSection title="Preparação da chegada">
      {data ? (
        <>
          <div data-usage-guide="arrival-occupancy">
            <p>
              Quantidade de hóspedes: <strong>{data.guest_count}</strong>. O
              titular responde pela reserva; acompanhantes são pessoas
              hospedadas.
            </p>
            {data.accommodations.map((item) => (
              <div key={item.id}>
                <p>
                  {item.room_type} · {item.adults} adulto(s) · {item.children}{" "}
                  criança(s)
                </p>
                <p>
                  Diárias contratadas:{" "}
                  {item.nights
                    .map(
                      (night) => `${night.date}: ${formatMoney(night.amount)}`,
                    )
                    .join(" · ")}
                </p>
                <p>
                  Garantia:{" "}
                  {(
                    {
                      first_night: "primeira diária",
                      fixed: "valor fixo",
                      percentage: "percentual",
                      none: "sem sinal obrigatório",
                    } as Record<string, string>
                  )[item.guarantee_type || ""] || "sem exigência definida"}
                  .
                </p>
              </div>
            ))}
          </div>
          <div data-usage-guide="arrival-guarantee">
            <p>
              Sinal exigido: {formatMoney(data.guarantee_required)} · Recebido:{" "}
              {formatMoney(data.guarantee_received)} · Restante:{" "}
              {formatMoney(
                Math.max(0, data.guarantee_required - data.guarantee_received),
              )}
            </p>
            <p>
              O sinal é um adiantamento da hospedagem. Registrar aqui não
              significa receber o saldo integral.
            </p>
            {canManageGuarantees &&
            data.guarantee_required > data.guarantee_received ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void act("guarantees");
                }}
                className="grid gap-2"
              >
                <label className="pms-field">
                  Sinal via PIX (R$)
                  <input
                    className="pms-field-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      key.current = null;
                    }}
                  />
                </label>
                <label className="pms-field">
                  Referência do PIX
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
                <button className="pms-button-primary" disabled={pending}>
                  Registrar sinal via PIX
                </button>
              </form>
            ) : null}
          </div>
          {canManagePrearrival ? (
            <div data-usage-guide="arrival-prearrival" className="grid gap-2">
              <p>
                Pré-chegada:{" "}
                {data.submission
                  ? `recebida · horário previsto ${data.submission.arrival_time || "não informado"}`
                  : "ainda não enviada"}
                . O formulário não realiza check-in.
              </p>
              {data.guests.map((guest, index) => (
                <p key={`${guest.role}-${index}`}>
                  {guest.role === "primary" ? "Titular" : "Acompanhante"}:{" "}
                  {guest.full_name}
                </p>
              ))}
              <button
                type="button"
                className="pms-button-secondary"
                disabled={pending}
                onClick={() => void act("prearrival-links")}
              >
                {link
                  ? "Regenerar link de pré-chegada"
                  : "Gerar link de pré-chegada"}
              </button>
              <p>
                Validade de 24 horas. Gerar outro link revoga o anterior. Copie
                agora; o acesso não será exibido novamente após fechar o painel.
              </p>
              {link ? (
                <>
                  <a href={link} target="_blank" rel="noreferrer">
                    Abrir pré-chegada
                  </a>
                  <button
                    type="button"
                    className="pms-button-secondary"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(link)
                        .then(() => setMessage("Link copiado."))
                        .catch(() =>
                          setMessage(
                            "Não foi possível copiar. Abra o link pelo botão.",
                          ),
                        );
                    }}
                  >
                    Copiar link de pré-chegada
                  </button>
                </>
              ) : null}
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
                Atualizar dados da pré-chegada
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p>Consultando preparação da chegada…</p>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </PanelSection>
  );
}
