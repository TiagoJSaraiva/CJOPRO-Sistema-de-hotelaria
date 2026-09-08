"use client";
import { useEffect, useRef, useState } from "react";
import {
  authorizedConsumptionModes,
  suggestedConsumptionMode,
  groupConsumptionOffers,
  type AdminConsumptionOperationalContext,
  type AdminConsumptionOrderCreateInput,
  type AdminConsumptionOrder,
  type ConsumptionBillingMode,
  type ConsumptionPaymentMethod,
} from "@hotel/shared";
import { billingModeLabel } from "./BillingModeFields";
import {
  postConsumptionOrderAction,
  refreshConsumptionContext,
} from "../operationActions";
import { Receipt } from "./ConsumptionOrderComposer";

export function ConsumptionSplitQueue({
  initialContext,
  quantities,
  pointId,
  metadata,
  canReceive,
  close,
}: {
  initialContext: AdminConsumptionOperationalContext;
  quantities: Record<string, number>;
  pointId: string;
  metadata: { guest: string; occurredAt: string; notes: string };
  canReceive: boolean;
  close: () => void;
}) {
  const [context, setContext] = useState(initialContext);
  const [remaining, setRemaining] = useState(quantities);
  const offers = context.offers.filter(
    (offer) => offer.point_id === pointId && (remaining[offer.id] || 0) > 0,
  );
  const [choices, setChoices] = useState<
    Record<string, ConsumptionBillingMode | "">
  >(() =>
    Object.fromEntries(
      offers.map((offer) => [
        offer.id,
        suggestedConsumptionMode(offer, canReceive),
      ]),
    ),
  );
  const [receipts, setReceipts] = useState<AdminConsumptionOrder[]>([]);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const requestKeys = useRef(new Map<string, string>());
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [request, setRequest] =
    useState<AdminConsumptionOrderCreateInput | null>(null);
  const groups = groupConsumptionOffers(offers, choices);
  const incomplete = Object.keys(remaining).some(
    (id) =>
      (remaining[id] || 0) > 0 &&
      !offers.some(
        (offer) =>
          offer.id === id &&
          choices[id] &&
          authorizedConsumptionModes(offer, canReceive).includes(
            choices[id] as ConsumptionBillingMode,
          ),
      ),
  );
  const hasRemaining = Object.values(remaining).some(
    (quantity) => quantity > 0,
  );
  useEffect(() => {
    if (!hasRemaining) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        link &&
        !window.confirm(
          "Há grupos pendentes. Confira o histórico antes de reconstruir a compra. Sair?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [hasRemaining]);
  async function send(payload: AdminConsumptionOrderCreateInput) {
    if (submitting.current) return;
    submitting.current = true;
    const content = JSON.stringify({ ...payload, idempotency_key: undefined });
    const key = requestKeys.current.get(content) || payload.idempotency_key;
    requestKeys.current.set(content, key);
    payload = { ...payload, idempotency_key: key };
    setPending(true);
    setError("");
    setRequest(payload);
    try {
      const result = await postConsumptionOrderAction(payload);
      if (result.receipt) {
        setReceipts((current) => [...current, result.receipt!]);
        setRemaining((current) => {
          const next = { ...current };
          payload.lines.forEach((line) => {
            delete next[line.offer_id];
          });
          return next;
        });
        setRequest(null);
        setUncertain(false);
        setConflict(false);
      } else {
        setError(result.error || "Falha ao confirmar grupo.");
        setConflict(result.conflict);
        setUncertain(!!result.uncertain);
        if (!result.uncertain) setRequest(null);
      }
    } catch {
      setError(
        "Resposta incerta. Repita a mesma solicitação antes de alterar este grupo.",
      );
      setUncertain(true);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  async function refresh() {
    setPending(true);
    try {
      const updated = await refreshConsumptionContext(
        context.stay.id,
        metadata.occurredAt,
      );
      setContext(updated);
      setChoices(
        Object.fromEntries(
          updated.offers.map((offer) => [
            offer.id,
            suggestedConsumptionMode(offer, canReceive),
          ]),
        ),
      );
      setConflict(false);
      setError(
        "Contexto atualizado. Revise novamente os itens e confirme cada grupo restante.",
      );
    } catch {
      setError(
        "Não foi possível atualizar. Os recibos e itens pendentes foram preservados.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="grid gap-4" data-usage-guide="consumption-split-queue">
      <h2>Organizar cobranças</h2>
      <p>
        Os itens não aceitam uma cobrança única. Cada grupo gera sua própria
        comanda e recibo. Após recarregar ou sair, confira o histórico antes de
        lançar novamente.
      </p>
      {receipts.map((receipt) => (
        <Receipt key={receipt.id} order={receipt} />
      ))}
      {error && <p role="alert">{error}</p>}
      {uncertain && request ? (
        <button
          disabled={pending}
          onClick={() => void send(request)}
          className="rounded-lg border border-slate-800 bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
        >
          Repetir a mesma solicitação
        </button>
      ) : null}
      {conflict && (
        <button
          disabled={pending}
          onClick={() => void refresh()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:opacity-50"
        >
          Atualizar preços e políticas
        </button>
      )}
      <fieldset
        disabled={pending || uncertain || conflict}
        className="grid gap-3 border-0 p-0"
      >
        <legend>Itens ainda não lançados</legend>
        {Object.entries(remaining)
          .filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => {
            const offer = offers.find((item) => item.id === id);
            const modes = offer
              ? authorizedConsumptionModes(offer, canReceive)
              : [];
            return (
              <div key={id} className="pms-surface-card">
                <label className="pms-field">
                  {quantity} × {offer?.product_name || "Item indisponível"}
                  <select
                    aria-label={`Cobrança de ${offer?.product_name || "item indisponível"}`}
                    className="pms-field-input"
                    value={choices[id] || ""}
                    onChange={(event) =>
                      setChoices((current) => ({
                        ...current,
                        [id]: event.target.value as ConsumptionBillingMode,
                      }))
                    }
                  >
                    <option value="">Sem cobrança disponível</option>
                    {modes.map((mode) => (
                      <option key={mode} value={mode}>
                        {billingModeLabel(mode)}
                      </option>
                    ))}
                  </select>
                </label>
                {!modes.length && (
                  <p>
                    Sem modo autorizado ou oferta indisponível. Remova o item ou
                    atualize o contexto.
                  </p>
                )}
                <button
                  onClick={() =>
                    setRemaining((current) => ({ ...current, [id]: 0 }))
                  }
                >
                  Remover este item
                </button>
              </div>
            );
          })}
      </fieldset>
      {groups.map((group, index) => (
        <form
          key={group.key}
          className="pms-surface-card grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (pending || incomplete || uncertain || conflict) return;
            void send({
              stay_id: context.stay.id,
              point_id: pointId,
              guest_customer_id: metadata.guest || null,
              occurred_at: metadata.occurredAt,
              notes: metadata.notes || null,
              disposition: "charged",
              billing_mode: group.mode,
              payment_method:
                group.mode === "hotel_immediate"
                  ? (String(data.get("method")) as ConsumptionPaymentMethod)
                  : null,
              payment_reference: String(data.get("reference") || "") || null,
              partner_receipt_confirmed:
                group.mode === "partner_direct" &&
                data.get("partner_confirmed") === "on",
              idempotency_key: crypto.randomUUID(),
              lines: group.offers.map((offer) => ({
                offer_id: offer.id,
                quantity: remaining[offer.id] || 0,
                version_token: offer.version_token,
              })),
            });
          }}
        >
          <h3>
            Grupo {index + 1} — {billingModeLabel(group.mode)}
          </h3>
          <p role="status">
            {request?.lines.some((line) =>
              group.offers.some((offer) => offer.id === line.offer_id),
            )
              ? uncertain
                ? "Resposta incerta: repita a mesma solicitação."
                : pending
                  ? "Confirmando comanda…"
                  : "Aguardando confirmação"
              : conflict
                ? "Revisão necessária"
                : "Aguardando confirmação"}
          </p>
          <ul>
            {group.offers.map((offer) => (
              <li key={offer.id}>
                {remaining[offer.id] || 0} × {offer.product_name} ·{" "}
                {offer.partner_name || "Hotel"}
              </li>
            ))}
          </ul>
          <strong>
            Total:{" "}
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: group.offers[0]?.currency || "BRL",
            }).format(
              group.offers.reduce(
                (sum, offer) =>
                  sum + offer.unit_price * (remaining[offer.id] || 0),
                0,
              ),
            )}
          </strong>
          <fieldset
            disabled={pending || uncertain || conflict || incomplete}
            className="grid gap-2 border-0 p-0"
          >
            {group.mode === "hotel_immediate" && (
              <>
                <label className="pms-field">
                  Meio de pagamento
                  <select name="method" className="pms-field-input">
                    <option value="pix">PIX</option>
                    <option value="cash">Dinheiro</option>
                    <option value="credit_card">Cartão de crédito</option>
                    <option value="debit_card">Cartão de débito</option>
                    <option value="bank_transfer">
                      Transferência bancária
                    </option>
                  </select>
                </label>
                <label className="pms-field">
                  Referência
                  <input
                    name="reference"
                    maxLength={120}
                    className="pms-field-input"
                  />
                </label>
              </>
            )}
            {group.mode === "partner_direct" && (
              <label className="pms-field">
                <input type="checkbox" name="partner_confirmed" required />{" "}
                Confirmo que este parceiro recebeu diretamente.
              </label>
            )}
            <button className="rounded-lg border border-slate-800 bg-slate-800 px-3 py-2 text-white disabled:opacity-50">
              Confirmar este grupo
            </button>
          </fieldset>
        </form>
      ))}
      {!hasRemaining && (
        <p role="status">
          Todos os grupos foram tratados. Os recibos acima permanecem no
          histórico.
        </p>
      )}
      <button
        disabled={pending || uncertain}
        onClick={() => {
          if (
            !hasRemaining ||
            window.confirm(
              "Abandonar grupos pendentes? Os já lançados permanecem no histórico.",
            )
          )
            close();
        }}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:opacity-50"
      >
        Encerrar atendimento
      </button>
    </section>
  );
}
