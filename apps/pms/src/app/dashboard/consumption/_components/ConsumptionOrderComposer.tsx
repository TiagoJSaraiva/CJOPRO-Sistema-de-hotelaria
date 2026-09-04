"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  AdminConsumptionOperationalContext,
  AdminConsumptionOrder,
  AdminConsumptionOrderCreateInput,
  ConsumptionBillingMode,
  ConsumptionPaymentMethod,
} from "@hotel/shared";
import { billingModeLabel } from "./BillingModeFields";
import { useModalFocus } from "../../_components/useModalFocus";
import {
  postConsumptionOrderAction,
  type ConsumptionPostState,
} from "../operationActions";

const paymentLabels: Record<ConsumptionPaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  bank_transfer: "Transferência bancária",
};

const reasonLabels: Record<string, string> = {
  point_inactive: "Ponto inativo",
  offer_inactive: "Oferta inativa",
  product_inactive: "Produto inativo",
  category_inactive: "Categoria inativa",
  partner_inactive: "Parceiro inativo",
  partner_archived: "Parceiro arquivado",
  agreement_missing: "Acordo ausente",
  agreement_revision_missing: "Sem revisão vigente no horário informado",
  billing_mode_incompatible: "Cobrança incompatível com o acordo",
};

function currency(value: number, code: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: code,
  }).format(value);
}

function localDateTimeInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function Receipt({ order }: { order: AdminConsumptionOrder }) {
  return (
    <section
      className="pms-surface-card grid gap-4"
      aria-live="polite"
      data-usage-guide="consumption-receipt"
    >
      <div>
        <p className="m-0 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Comanda lançada
        </p>
        <h2 className="m-0 text-xl">Recibo {order.id.slice(0, 8)}</h2>
      </div>
      <dl className="grid gap-2 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-slate-600">Estadia</dt>
          <dd className="m-0 font-semibold">
            Quarto {order.room_number} · {order.reservation_code}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Cobrança</dt>
          <dd className="m-0 font-semibold">
            {order.disposition === "courtesy"
              ? "Cortesia"
              : order.billing_mode
                ? billingModeLabel(order.billing_mode)
                : "Não classificada"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Total líquido</dt>
          <dd className="m-0 font-semibold">
            {currency(order.net_amount, order.currency)}
          </dd>
        </div>
      </dl>
      <ul className="m-0 grid gap-2 p-0" aria-label="Itens do recibo">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="flex justify-between gap-3 border-t border-slate-200 pt-2"
          >
            <span>
              {item.quantity} × {item.product_name}
            </span>
            <strong>{currency(item.net_amount, order.currency)}</strong>
          </li>
        ))}
      </ul>
      <a
        className="pms-button-secondary w-fit"
        href={`/dashboard/consumption/history?id=${order.id}`}
      >
        Abrir ficha completa
      </a>
    </section>
  );
}

export function ConsumptionOrderComposer({
  context,
  canReceivePayment,
  canGrantCourtesy,
}: {
  context: AdminConsumptionOperationalContext;
  canReceivePayment: boolean;
  canGrantCourtesy: boolean;
}) {
  const points = useMemo(
    () =>
      Array.from(
        new Map(
          context.offers.map((offer) => [offer.point_id, offer.point_name]),
        ),
      ),
    [context.offers],
  );
  const [pointId, setPointId] = useState(points[0]?.[0] || "");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<ConsumptionBillingMode | "courtesy" | "">(
    "",
  );
  const [paymentMethod, setPaymentMethod] =
    useState<ConsumptionPaymentMethod>("pix");
  const [partnerConfirmed, setPartnerConfirmed] = useState(false);
  const [courtesyReason, setCourtesyReason] = useState("");
  const [state, setState] = useState<ConsumptionPostState>({
    receipt: null,
    error: null,
    conflict: false,
  });
  const [reviewData, setReviewData] = useState<FormData | null>(null);
  const [pending, startTransition] = useTransition();
  const reviewDialogRef = useModalFocus<HTMLElement>(
    reviewData !== null,
    closeReview,
  );
  const pointOffers = context.offers.filter(
    (offer) => offer.point_id === pointId,
  );
  const selected = pointOffers.filter(
    (offer) => (quantities[offer.id] || 0) > 0,
  );
  const modes = selected.length
    ? selected.reduce<ConsumptionBillingMode[]>(
        (current, offer) =>
          current.filter((item) => offer.allowed_modes.includes(item)),
        [...(selected[0]?.allowed_modes || [])],
      )
    : [];
  const directPartnerKeys = new Set(
    selected.map(
      (offer) =>
        `${offer.partner_id || "hotel"}:${offer.agreement_id || "none"}`,
    ),
  );
  const visibleModes = modes.filter(
    (item) =>
      (item !== "hotel_immediate" || canReceivePayment) &&
      (item !== "partner_direct" ||
        (directPartnerKeys.size === 1 &&
          selected.every((offer) => offer.provider_type === "partner"))),
  );
  const suggestedMode =
    selected.length > 0 &&
    selected.every(
      (offer) =>
        offer.default_mode && offer.default_mode === selected[0]?.default_mode,
    ) &&
    visibleModes.includes(selected[0]?.default_mode as ConsumptionBillingMode)
      ? selected[0]?.default_mode || null
      : null;
  const total = selected.reduce(
    (sum, offer) => sum + offer.unit_price * (quantities[offer.id] || 0),
    0,
  );

  useEffect(() => {
    if (!mode && suggestedMode) setMode(suggestedMode);
    if (mode && mode !== "courtesy" && !visibleModes.includes(mode))
      setMode("");
  }, [mode, suggestedMode, visibleModes]);

  function changeQuantity(offerId: string, value: number) {
    setQuantities((current) => ({ ...current, [offerId]: Math.max(0, value) }));
    setState((current) => ({ ...current, receipt: null, error: null }));
  }

  function requestReview(formData: FormData) {
    if (!selected.length || !mode) {
      setState({
        receipt: null,
        error: "Adicione ao menos um item e escolha o desfecho financeiro.",
        conflict: false,
      });
      return;
    }
    setReviewData(formData);
  }

  function closeReview() {
    setReviewData(null);
  }

  function submit(formData: FormData) {
    if (!mode) return;
    const occurredAtRaw = String(formData.get("occurred_at") || "");
    const payload: AdminConsumptionOrderCreateInput = {
      stay_id: context.stay.id,
      point_id: pointId,
      guest_customer_id:
        String(formData.get("guest_customer_id") || "") || null,
      occurred_at: new Date(occurredAtRaw).toISOString(),
      disposition:
        mode === "courtesy" ? ("courtesy" as const) : ("charged" as const),
      billing_mode: mode === "courtesy" ? null : mode,
      payment_method: mode === "hotel_immediate" ? paymentMethod : null,
      payment_reference:
        String(formData.get("payment_reference") || "") || null,
      partner_receipt_confirmed: mode === "partner_direct" && partnerConfirmed,
      courtesy_reason: mode === "courtesy" ? courtesyReason : null,
      notes: String(formData.get("notes") || "") || null,
      idempotency_key: crypto.randomUUID(),
      lines: selected.map((offer) => ({
        offer_id: offer.id,
        quantity: quantities[offer.id] || 0,
        version_token: offer.version_token,
      })),
    };
    startTransition(async () =>
      setState(await postConsumptionOrderAction(payload)),
    );
  }

  if (state.receipt) return <Receipt order={state.receipt} />;

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        requestReview(new FormData(event.currentTarget));
      }}
    >
      <section
        className="pms-surface-card grid gap-4"
        data-usage-guide="consumption-cart"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <label className="pms-field">
            Ponto de consumo
            <select
              className="pms-field-input"
              value={pointId}
              onChange={(event) => {
                setPointId(event.target.value);
                setQuantities({});
                setMode("");
              }}
            >
              {points.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="pms-field">
            Hóspede atribuído (opcional)
            <select
              name="guest_customer_id"
              className="pms-field-input"
              defaultValue=""
            >
              <option value="">Hóspede principal</option>
              {context.guests.map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guest.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="pms-field">
            Horário do consumo
            <input
              name="occurred_at"
              type="datetime-local"
              required
              className="pms-field-input"
              min={localDateTimeInput(context.stay.checkin_date_actual)}
              max={localDateTimeInput(context.occurred_at)}
              defaultValue={localDateTimeInput(context.occurred_at)}
            />
          </label>
        </div>
        <div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          aria-label="Ofertas do ponto"
        >
          {pointOffers.map((offer) => (
            <article
              key={offer.id}
              className={`rounded-xl border p-3 ${offer.available ? "border-slate-200" : "border-slate-200 bg-slate-100 text-slate-500"}`}
            >
              <div className="flex justify-between gap-3">
                <strong>{offer.product_name}</strong>
                <span>{currency(offer.unit_price, offer.currency)}</span>
              </div>
              <p className="my-1 text-sm">
                {offer.category_name} · {offer.partner_name || "Hotel"}
              </p>
              {offer.available ? (
                <label className="pms-field mt-2">
                  Quantidade
                  <input
                    aria-label={`Quantidade de ${offer.product_name}`}
                    className="pms-field-input"
                    type="number"
                    min="0"
                    max="9999"
                    step={offer.sales_unit === "hour" ? "0.25" : "1"}
                    value={quantities[offer.id] || 0}
                    onChange={(event) =>
                      changeQuantity(offer.id, Number(event.target.value))
                    }
                  />
                </label>
              ) : (
                <p className="mb-0 text-sm">
                  Indisponível:{" "}
                  {offer.reasons
                    .map((reason) => reasonLabels[reason] || reason)
                    .join(", ")}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section
        className="pms-surface-card grid gap-4"
        data-usage-guide="consumption-billing"
      >
        <div>
          <h2 className="m-0 text-xl">Cobrança</h2>
          <p className="mb-0 text-sm text-slate-600">
            Só aparecem opções aceitas por todos os itens do carrinho.
          </p>
        </div>
        <fieldset className="grid gap-2">
          <legend className="font-semibold">Desfecho financeiro</legend>
          {visibleModes.map((item) => (
            <label key={item} className="flex gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === item}
                onChange={() => setMode(item)}
              />{" "}
              {billingModeLabel(item)}
            </label>
          ))}
          {canGrantCourtesy ? (
            <label className="flex gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "courtesy"}
                onChange={() => setMode("courtesy")}
              />{" "}
              Cortesia integral
            </label>
          ) : null}
        </fieldset>
        {mode === "hotel_immediate" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="pms-field">
              Meio de pagamento
              <select
                className="pms-field-input"
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value as ConsumptionPaymentMethod,
                  )
                }
              >
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="pms-field">
              Referência (opcional)
              <input
                name="payment_reference"
                maxLength={120}
                className="pms-field-input"
              />
            </label>
          </div>
        ) : null}
        {mode === "partner_direct" ? (
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={partnerConfirmed}
              onChange={(event) => setPartnerConfirmed(event.target.checked)}
              required
            />{" "}
            Confirmo que o parceiro recebeu diretamente do hóspede.
          </label>
        ) : null}
        {mode === "courtesy" ? (
          <label className="pms-field">
            Justificativa da cortesia
            <textarea
              className="pms-field-input"
              minLength={3}
              maxLength={1000}
              required
              value={courtesyReason}
              onChange={(event) => setCourtesyReason(event.target.value)}
            />
          </label>
        ) : null}
        <label className="pms-field">
          Observação (opcional)
          <textarea name="notes" maxLength={1000} className="pms-field-input" />
        </label>
      </section>

      <section
        className="pms-surface-card flex flex-wrap items-center justify-between gap-4"
        data-usage-guide="consumption-review"
        aria-live="polite"
      >
        <div>
          <span className="block text-sm text-slate-600">
            {selected.length} item(ns)
          </span>
          <strong className="text-2xl">
            {currency(
              mode === "courtesy" ? 0 : total,
              selected[0]?.currency || "BRL",
            )}
          </strong>
          {mode === "courtesy" ? (
            <span className="ml-2 text-sm">
              ({currency(total, selected[0]?.currency || "BRL")} em desconto)
            </span>
          ) : null}
        </div>
        <button
          className="pms-button-primary"
          type="submit"
          disabled={pending || !selected.length || !mode}
        >
          {pending ? "Lançando…" : "Revisar comanda"}
        </button>
      </section>
      {state.error ? (
        <div
          role="alert"
          tabIndex={-1}
          className={`rounded-lg border p-3 ${state.conflict ? "border-amber-400 bg-amber-50" : "border-red-300 bg-red-50"}`}
        >
          {state.error}
          {state.conflict ? (
            <div>
              <button
                className="pms-button-secondary mt-2"
                type="button"
                onClick={() => location.reload()}
              >
                Atualizar preços e políticas
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {reviewData ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          role="presentation"
        >
          <section
            ref={reviewDialogRef}
            className="pms-surface-card w-full max-w-xl"
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby="consumption-review-title"
          >
            <h2 id="consumption-review-title" className="mt-0">
              Confirmar comanda
            </h2>
            <p>
              Você lançará {selected.length} item(ns) no valor líquido de{" "}
              <strong>
                {currency(
                  mode === "courtesy" ? 0 : total,
                  selected[0]?.currency || "BRL",
                )}
              </strong>
              .
            </p>
            <p className="text-sm text-slate-600">
              {mode === "courtesy"
                ? "A cortesia registra desconto integral e não movimenta o caixa."
                : mode
                  ? billingModeLabel(mode)
                  : ""}
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="pms-button-secondary"
                type="button"
                onClick={closeReview}
              >
                Voltar
              </button>
              <button
                className="pms-button-primary"
                type="button"
                onClick={() => {
                  const data = reviewData;
                  setReviewData(null);
                  submit(data);
                }}
              >
                Confirmar lançamento
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </form>
  );
}
