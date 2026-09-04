"use client";

import { useMemo, useState, type FormEvent } from "react";
import type {
  AdminStayAccount,
  AdminStayFolioAllocationPreview,
  AdminStayOperationalPanelResponse,
  ConsumptionPaymentMethod,
} from "@hotel/shared";
import { ContextHelp } from "../../_components/ContextHelp";
import {
  DetailItem,
  PanelSection,
  PaymentSummaryCard,
  StatusPill,
  formatDateDisplay,
  formatMoney,
  paymentMethodLabel,
  paymentStatusLabel,
} from "./OperationalPanelPrimitives";

type ApiErrorPayload = {
  message?: string;
  details?: string | null;
};
type PanelWithAccount = AdminStayOperationalPanelResponse & {
  account?: AdminStayAccount;
};

const primaryButtonClassName =
  "cursor-pointer rounded-lg border border-[#14564c] bg-[#1b7a6c] px-[0.85rem] py-[0.58rem] font-semibold text-white disabled:cursor-not-allowed disabled:border-[#d2d6db] disabled:bg-[#eef2f6] disabled:text-[#98a2b3]";
const secondaryButtonClassName =
  "cursor-pointer rounded-lg border border-[#d2d6db] bg-white px-[0.85rem] py-[0.58rem] font-semibold text-[#344054] disabled:cursor-not-allowed disabled:bg-[#eef2f6] disabled:text-[#98a2b3]";

async function parseApiError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
  const error = new Error(payload.message || fallback) as Error & {
    details?: string | null;
  };
  error.details = payload.details;
  return error;
}

async function getJson<T>(url: string, fallback: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw await parseApiError(response, fallback);
  }

  return (await response.json()) as T;
}

async function postJson<T>(
  url: string,
  body: unknown,
  fallback: string,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await parseApiError(response, fallback);
  }

  return (await response.json()) as T;
}

function getStayBalance(panel: AdminStayOperationalPanelResponse): number {
  return Math.max(
    Number(panel.stay.total_price_estimated || 0) -
      Number(panel.stay.total_paid || 0),
    0,
  );
}

function formatPaymentInputValue(value: number): string {
  return value > 0 ? value.toFixed(2) : "";
}

function accountFromPanel(
  panel: AdminStayOperationalPanelResponse,
): AdminStayAccount {
  const checkoutBalance = getStayBalance(panel);
  const folio = panel.folio || {
    stay_id: panel.stay.id,
    currency: "BRL",
    entries: [],
    allocations: [],
    total_debits: panel.stay.total_price_estimated,
    total_credits: panel.stay.total_paid,
    balance: checkoutBalance,
    payment_status: panel.stay.stay_payment_status,
    pending_maintenance_entry_ids: [],
  };
  return {
    stay_id: panel.stay.id,
    reservation_id: panel.stay.reservation_id,
    reservation_code: panel.stay.reservation_code,
    room_number: panel.stay.room_number,
    guest_name: panel.stay.customer_name,
    stay_status: panel.stay.stay_status,
    currency: folio.currency,
    version: panel.stay.account_version || 0,
    status:
      panel.stay.stay_status === "checked_out"
        ? "closed"
        : checkoutBalance === 0
          ? "ready_to_checkout"
          : "open",
    folio: { ...folio, checkout_balance: checkoutBalance },
    consumption_orders: [],
    corrections: [],
    payment_batches: [],
    refunds: [],
    checkout_record: null,
  };
}

export function CheckoutByRoomWorkflow({
  initialRoomNumber = "",
}: {
  initialRoomNumber?: string;
}) {
  const [roomNumber, setRoomNumber] = useState(initialRoomNumber);
  const [panelData, setPanelData] =
    useState<AdminStayOperationalPanelResponse | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [paymentNote, setPaymentNote] = useState("");
  const [allocationPreview, setAllocationPreview] =
    useState<AdminStayFolioAllocationPreview | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [maintenanceAcknowledged, setMaintenanceAcknowledged] = useState(false);
  const [accountData, setAccountData] = useState<AdminStayAccount | null>(null);
  const [checkoutTenders, setCheckoutTenders] = useState<
    Array<{
      payment_method: ConsumptionPaymentMethod;
      amount: string;
      reference_code: string;
    }>
  >([{ payment_method: "pix", amount: "", reference_code: "" }]);

  const balance = useMemo(
    () =>
      accountData
        ? Number(accountData.folio.checkout_balance || 0)
        : panelData
          ? getStayBalance(panelData)
          : 0,
    [accountData, panelData],
  );
  const checkoutTenderTotal = useMemo(
    () =>
      Number(
        checkoutTenders
          .reduce((sum, tender) => sum + Number(tender.amount || 0), 0)
          .toFixed(2),
      ),
    [checkoutTenders],
  );
  const hasPendingAccountAction = Boolean(
    accountData?.corrections.some((correction) =>
      [
        "pending",
        "approved",
        "awaiting_refund",
        "awaiting_partner_refund",
      ].includes(correction.status),
    ),
  );

  function applyPanel(panel: AdminStayOperationalPanelResponse) {
    setPanelData(panel);
    setPaymentAmount(formatPaymentInputValue(getStayBalance(panel)));
    setPaymentNote("");
    setAllocationPreview(null);
    setMaintenanceAcknowledged(false);
  }

  function applyAccount(account: AdminStayAccount) {
    setAccountData(account);
    if (account.stay_status === "checked_out") {
      setPanelData((current) =>
        current
          ? {
              ...current,
              stay: {
                ...current.stay,
                stay_status: "checked_out",
                checkout_date_actual:
                  account.checkout_record?.checked_out_at ||
                  current.stay.checkout_date_actual,
              },
              eligibility: {
                ...current.eligibility,
                can_checkout: false,
                checkout_block_reason:
                  "A estadia precisa estar em checked_in para checkout.",
              },
            }
          : current,
      );
    }
    const outstanding = Number(account.folio.checkout_balance || 0);
    setCheckoutTenders([
      {
        payment_method: "pix",
        amount: formatPaymentInputValue(outstanding),
        reference_code: "",
      },
    ]);
  }

  async function handleAllocationPreview() {
    if (!panelData) return;
    const amount = Number(paymentAmount.replace(",", ".") || "0");
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Valor de pagamento invalido.");
      return;
    }
    try {
      setIsPending(true);
      setError(null);
      const preview = await postJson<AdminStayFolioAllocationPreview>(
        `/api/stays/${panelData.stay.id}/payments/allocation-preview`,
        { amount },
        "Falha ao sugerir a alocação do pagamento.",
      );
      setAllocationPreview(preview);
    } catch (requestError) {
      setAllocationPreview(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha ao sugerir a alocação do pagamento.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedRoomNumber = roomNumber.trim();
    if (!normalizedRoomNumber) {
      setError("Informe o numero do quarto.");
      setSuccess(null);
      setPanelData(null);
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      setSuccess(null);
      const query = new URLSearchParams({ room_number: normalizedRoomNumber });
      const panel = await getJson<PanelWithAccount>(
        `/api/stays/checkout-candidate?${query.toString()}`,
        "Falha ao localizar estadia para checkout.",
      );
      applyPanel(panel);
      applyAccount(panel.account || accountFromPanel(panel));
    } catch (requestError) {
      setPanelData(null);
      setAccountData(null);
      setPaymentAmount("");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha ao localizar estadia para checkout.",
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function handleAddPayment() {
    if (!panelData || !accountData) return;

    const amount = Number(paymentAmount.replace(",", ".") || "0");
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Valor de pagamento invalido.");
      setSuccess(null);
      return;
    }

    try {
      setIsPending(true);
      setError(null);
      setSuccess(null);
      const account = await postJson<AdminStayAccount>(
        `/api/stays/${panelData.stay.id}/payment-batches`,
        {
          tenders: [{ payment_method: paymentMethod, amount }],
          expected_version: accountData.version,
          idempotency_key: crypto.randomUUID(),
          note: paymentNote || null,
        },
        "Falha ao registrar pagamento.",
      );
      applyAccount(account);
      setPaymentAmount("");
      setPaymentNote("");
      setAllocationPreview(null);
      setSuccess("Pagamento registrado.");
    } catch (requestError) {
      if (
        accountData &&
        requestError instanceof Error &&
        (requestError as Error & { details?: string }).details ===
          "version_conflict"
      ) {
        const refreshed = await getJson<AdminStayAccount>(
          `/api/stays/${accountData.stay_id}/account`,
          "Falha ao atualizar a conta.",
        ).catch(() => null);
        if (refreshed) setAccountData(refreshed);
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha ao registrar pagamento.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleCheckout() {
    if (!panelData) return;

    try {
      setIsPending(true);
      setError(null);
      setSuccess(null);
      if (!accountData) throw new Error("Conta da estadia não carregada.");
      if (balance > 0 && checkoutTenderTotal !== balance)
        throw new Error("A soma dos meios deve quitar exatamente o saldo.");
      const checkoutPayload = {
        expected_version: accountData.version,
        idempotency_key: crypto.randomUUID(),
        tenders:
          balance > 0
            ? checkoutTenders.map((tender) => ({
                payment_method: tender.payment_method,
                amount: Number(tender.amount),
                reference_code: tender.reference_code || null,
              }))
            : [],
        ...(maintenanceAcknowledged
          ? {
              maintenance_acknowledged_occurrence_ids: (
                panelData.maintenance_occurrences || []
              )
                .filter(
                  (occurrence) =>
                    occurrence.status !== "resolved" &&
                    occurrence.status !== "canceled",
                )
                .map((occurrence) => occurrence.id),
              maintenance_acknowledged_folio_entry_ids:
                panelData.maintenance_pending_folio_entry_ids || [],
            }
          : {}),
      };
      const checkoutResult = await postJson<
        AdminStayAccount | AdminStayOperationalPanelResponse
      >(
        `/api/stays/${panelData.stay.id}/checkout`,
        checkoutPayload,
        "Falha ao executar checkout.",
      );
      const account =
        "stay_id" in checkoutResult
          ? checkoutResult
          : accountFromPanel(checkoutResult);
      if (!("stay_id" in checkoutResult)) applyPanel(checkoutResult);
      applyAccount(account);
      setSuccess(`Checkout confirmado para o quarto ${account.room_number}.`);
    } catch (requestError) {
      if (
        accountData &&
        requestError instanceof Error &&
        (requestError as Error & { details?: string }).details ===
          "version_conflict"
      ) {
        const refreshed = await getJson<AdminStayAccount>(
          `/api/stays/${accountData.stay_id}/account`,
          "Falha ao atualizar a conta.",
        ).catch(() => null);
        if (refreshed) {
          setAccountData(refreshed);
          setError(
            "A conta mudou. Os meios informados foram preservados; revise os novos valores e confirme novamente.",
          );
          return;
        }
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha ao executar checkout.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="grid gap-4" data-testid="checkout-by-room-workflow">
      <section
        className="rounded-lg border border-[#d9dfe7] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
        data-usage-guide="maintenance-checkout-search"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-[1.05rem] font-semibold text-[#121926]">
              Checkout
            </h2>
            <p className="mb-0 mt-[0.25rem] text-[0.86rem] text-[#52606d]">
              Localizar estadia em check-in por quarto.
            </p>
          </div>
          <span className="rounded-full border border-[#e4e7ec] bg-[#f8fafc] px-[0.6rem] py-[0.25rem] text-[0.78rem] font-semibold text-[#52606d]">
            {panelData ? panelData.stay.room_number : "Aguardando busca"}
          </span>
        </div>

        <form
          onSubmit={handleSearch}
          className="mt-4 flex flex-col gap-3 md:flex-row md:items-end"
        >
          <label className="pms-field min-w-0 md:w-72">
            <span>Numero do quarto</span>
            <input
              value={roomNumber}
              onChange={(event) => setRoomNumber(event.target.value)}
              placeholder="Ex.: 102"
              className="pms-field-input w-full"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSearching || isPending}
              className={primaryButtonClassName}
            >
              {isSearching ? "Buscando..." : "Buscar"}
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => {
                setRoomNumber("");
                setPanelData(null);
                setAccountData(null);
                setPaymentAmount("");
                setPaymentNote("");
                setAllocationPreview(null);
                setError(null);
                setSuccess(null);
              }}
              disabled={isSearching || isPending}
            >
              Nova busca
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <p className="m-0 rounded-lg border border-[#f2a2a2] bg-[#fff2f2] p-3 text-[0.88rem] text-[#a12b2b]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="m-0 rounded-lg border border-[#b6e4cb] bg-[#f1fbf5] p-3 text-[0.88rem] font-semibold text-[#176c43]">
          {success}
        </p>
      ) : null}

      {panelData ? (
        <section
          className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"
          data-usage-guide="maintenance-checkout-stay"
        >
          <div className="grid gap-4">
            <PanelSection title="Dados da estadia">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-[1rem] text-[#121926]">
                  {panelData.stay.reservation_code || "Sem codigo"}
                </strong>
                <StatusPill status={panelData.stay.stay_status} />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <DetailItem
                  label="Hospede"
                  value={panelData.stay.customer_name || "Nao informado"}
                />
                <DetailItem
                  label="Quarto"
                  value={`${panelData.stay.room_number} - ${panelData.stay.room_type}`}
                />
                <DetailItem
                  label="Reserva"
                  value={panelData.reservation.code || panelData.reservation.id}
                />
                <DetailItem
                  label="Check-in previsto"
                  value={formatDateDisplay(
                    panelData.stay.checkin_date_expected,
                  )}
                />
                <DetailItem
                  label="Check-out previsto"
                  value={formatDateDisplay(
                    panelData.stay.checkout_date_expected,
                  )}
                />
                <DetailItem
                  label="Check-in real"
                  value={formatDateDisplay(panelData.stay.checkin_date_actual)}
                />
                <DetailItem
                  label="Check-out real"
                  value={formatDateDisplay(panelData.stay.checkout_date_actual)}
                />
                <DetailItem
                  label="Janela checkout"
                  value={`${panelData.hotel.checkout_time_start || "--"} - ${panelData.hotel.checkout_time_limit || "--"}`}
                />
                <DetailItem
                  label="Fuso do hotel"
                  value={panelData.hotel.timezone}
                />
              </div>
            </PanelSection>

            <PanelSection title="Financeiro">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <PaymentSummaryCard
                  label="Total estadia"
                  value={formatMoney(panelData.stay.total_price_estimated)}
                  detail={paymentStatusLabel(
                    panelData.stay.stay_payment_status,
                  )}
                  tone={
                    panelData.stay.stay_payment_status === "paid"
                      ? "good"
                      : "neutral"
                  }
                />
                <PaymentSummaryCard
                  label="Pago estadia"
                  value={formatMoney(panelData.stay.total_paid)}
                  detail="Recebido"
                  tone={panelData.stay.total_paid > 0 ? "good" : "neutral"}
                />
                <PaymentSummaryCard
                  label="Saldo"
                  value={formatMoney(balance)}
                  detail={balance > 0 ? "Pendente" : "Quitado"}
                  tone={balance > 0 ? "danger" : "good"}
                />
                <PaymentSummaryCard
                  label="Total reserva"
                  value={formatMoney(panelData.reservation.total_due)}
                  detail={paymentStatusLabel(
                    panelData.reservation.payment_status,
                  )}
                />
              </div>
            </PanelSection>

            {accountData ? (
              <PanelSection title="Conta detalhada">
                <div
                  className="grid grid-cols-2 gap-2 md:grid-cols-3"
                  data-usage-guide="stay-account-summary"
                >
                  <PaymentSummaryCard
                    label="Hospedagem"
                    value={formatMoney(accountData.folio.lodging_total || 0)}
                    detail="Incluído no checkout"
                  />
                  <PaymentSummaryCard
                    label="Consumos"
                    value={formatMoney(
                      accountData.folio.consumption_total || 0,
                    )}
                    detail={`${accountData.consumption_orders.length} comanda(s)`}
                  />
                  <PaymentSummaryCard
                    label="Manutenção"
                    value={formatMoney(
                      accountData.folio.maintenance_total || 0,
                    )}
                    detail="Exceção mediante ciência"
                  />
                  <PaymentSummaryCard
                    label="Crédito a reembolsar"
                    value={formatMoney(
                      accountData.folio.refundable_credit || 0,
                    )}
                    detail="Bloqueia o fechamento"
                    tone={
                      Number(accountData.folio.refundable_credit || 0) > 0
                        ? "danger"
                        : "good"
                    }
                  />
                </div>
                <div
                  className="overflow-x-auto"
                  data-usage-guide="stay-account-lines"
                  tabIndex={0}
                  role="region"
                  aria-label="Lançamentos da conta"
                >
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr>
                        <th>Grupo</th>
                        <th>Descrição</th>
                        <th className="text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountData.folio.entries.map((entry) => (
                        <tr
                          className="border-t border-slate-100"
                          key={entry.id}
                        >
                          <td className="py-2">{entry.kind}</td>
                          <td>{entry.description}</td>
                          <td className="text-right">
                            {entry.direction === "credit" ? "− " : ""}
                            {formatMoney(entry.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PanelSection>
            ) : null}

            {panelData.payments.length ? (
              <PanelSection title="Historico de pagamentos">
                <div className="max-h-52 overflow-auto rounded-lg border border-[#eef2f6]">
                  {panelData.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between gap-3 border-b border-[#eef2f6] px-3 py-2 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <strong className="block text-[0.82rem] text-[#202939]">
                          {paymentMethodLabel(payment.method)}
                        </strong>
                        <span className="block text-[0.75rem] text-[#52606d]">
                          {formatDateDisplay(payment.paid_at)}
                        </span>
                      </div>
                      <span className="whitespace-nowrap text-[0.82rem] font-semibold text-[#176c43]">
                        {formatMoney(payment.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </PanelSection>
            ) : null}
          </div>

          <aside
            className="grid content-start gap-4"
            data-usage-guide="maintenance-checkout-actions"
          >
            <PanelSection title="Registrar pagamento">
              <label className="pms-field">
                <span>Valor</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => {
                    setPaymentAmount(event.target.value);
                    setAllocationPreview(null);
                  }}
                  placeholder="Valor"
                  className="pms-field-input w-full"
                />
              </label>
              <label className="pms-field">
                <span>Metodo</span>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="pms-field-input w-full"
                >
                  <option value="cash">{paymentMethodLabel("cash")}</option>
                  <option value="pix">{paymentMethodLabel("pix")}</option>
                  <option value="credit_card">
                    {paymentMethodLabel("credit_card")}
                  </option>
                  <option value="debit_card">
                    {paymentMethodLabel("debit_card")}
                  </option>
                  <option value="bank_transfer">
                    {paymentMethodLabel("bank_transfer")}
                  </option>
                </select>
              </label>
              <label className="pms-field">
                <span>Observacao</span>
                <input
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                  placeholder="Opcional"
                  className="pms-field-input w-full"
                />
              </label>
              {panelData.folio ? (
                <button
                  type="button"
                  onClick={handleAllocationPreview}
                  disabled={isPending || !paymentAmount}
                  className={secondaryButtonClassName}
                >
                  Revisar alocação FIFO
                </button>
              ) : null}
              {allocationPreview ? (
                <div
                  className="grid gap-1 rounded-lg border border-[#d9dfe7] bg-[#f8fafc] p-3 text-sm"
                  aria-live="polite"
                >
                  <strong>Alocação sugerida</strong>
                  {allocationPreview.allocations.map((allocation) => {
                    const entry = panelData.folio?.entries.find(
                      (candidate) => candidate.id === allocation.debit_entry_id,
                    );
                    return (
                      <span key={allocation.debit_entry_id}>
                        {entry?.description || "Débito do fólio"}:{" "}
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: panelData.folio?.currency || "BRL",
                        }).format(allocation.amount)}
                      </span>
                    );
                  })}
                  {allocationPreview.unallocated_amount > 0 ? (
                    <span>
                      Crédito não alocado:{" "}
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: panelData.folio?.currency || "BRL",
                      }).format(allocationPreview.unallocated_amount)}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleAddPayment}
                disabled={
                  isPending ||
                  !paymentAmount ||
                  Boolean(panelData.folio && !allocationPreview)
                }
                className={secondaryButtonClassName}
              >
                Registrar pagamento
              </button>
            </PanelSection>

            <PanelSection title="Checkout">
              {accountData && balance > 0 ? (
                <div
                  className="grid gap-3"
                  data-usage-guide="stay-account-tenders"
                >
                  <div>
                    <strong>Pagamento multimeios</strong>
                    <p className="m-0 text-sm text-slate-600">
                      Divida o saldo em até dez parcelas. A soma deve ser exata.
                    </p>
                  </div>
                  {checkoutTenders.map((tender, index) => (
                    <div
                      className="grid grid-cols-[1fr_1fr_auto] gap-2"
                      key={index}
                    >
                      <select
                        aria-label={`Meio ${index + 1}`}
                        className="pms-field-input"
                        value={tender.payment_method}
                        onChange={(event) =>
                          setCheckoutTenders((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    payment_method: event.target
                                      .value as ConsumptionPaymentMethod,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        {(
                          [
                            "cash",
                            "pix",
                            "credit_card",
                            "debit_card",
                            "bank_transfer",
                          ] as const
                        ).map((method) => (
                          <option value={method} key={method}>
                            {paymentMethodLabel(method)}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`Valor ${index + 1}`}
                        className="pms-field-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={tender.amount}
                        onChange={(event) =>
                          setCheckoutTenders((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, amount: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className={secondaryButtonClassName}
                        disabled={checkoutTenders.length === 1}
                        onClick={() =>
                          setCheckoutTenders((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                        aria-label={`Remover meio ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={checkoutTenders.length >= 10}
                      onClick={() =>
                        setCheckoutTenders((current) => [
                          ...current,
                          {
                            payment_method: "cash",
                            amount: "",
                            reference_code: "",
                          },
                        ])
                      }
                    >
                      Adicionar meio
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => {
                        const other = checkoutTenders
                          .slice(0, -1)
                          .reduce(
                            (sum, item) => sum + Number(item.amount || 0),
                            0,
                          );
                        setCheckoutTenders((current) =>
                          current.map((item, index) =>
                            index === current.length - 1
                              ? {
                                  ...item,
                                  amount: formatPaymentInputValue(
                                    Math.max(balance - other, 0),
                                  ),
                                }
                              : item,
                          ),
                        );
                      }}
                    >
                      Preencher restante
                    </button>
                  </div>
                  <p className="m-0 text-sm font-semibold" aria-live="polite">
                    Informado {formatMoney(checkoutTenderTotal)} · Restante{" "}
                    {formatMoney(Math.max(balance - checkoutTenderTotal, 0))}
                  </p>
                </div>
              ) : null}
              {Boolean(
                (panelData.maintenance_occurrences || []).length ||
                panelData.maintenance_financial_acknowledgement_required,
              ) ? (
                <div
                  className="flex items-center gap-1 text-sm font-semibold text-[#8a5a00]"
                  data-usage-guide="maintenance-checkout-acknowledgement"
                >
                  Ciência de manutenção
                  <ContextHelp label="Ciência de manutenção no checkout">
                    Declarar ciência não atribui responsabilidade, não registra
                    pagamento e não encerra a ocorrência. A pendência permanece
                    acompanhada após o checkout.
                  </ContextHelp>
                </div>
              ) : null}
              {(panelData.maintenance_occurrences || []).length ? (
                <div className="grid gap-2 rounded-lg border border-[#f5d08a] bg-[#fff9eb] p-3 text-[0.86rem]">
                  <strong>Ocorrências e danos vinculados</strong>
                  <ul className="m-0 pl-5">
                    {panelData.maintenance_occurrences!.map((occurrence) => (
                      <li key={occurrence.id}>
                        {occurrence.code} · {occurrence.description} ·{" "}
                        {occurrence.status}
                      </li>
                    ))}
                  </ul>
                  {panelData.maintenance_acknowledgement_required ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={maintenanceAcknowledged}
                        onChange={(event) =>
                          setMaintenanceAcknowledged(event.target.checked)
                        }
                      />{" "}
                      Declaro ciência das ocorrências abertas; o checkout não
                      atribui responsabilidade.
                    </label>
                  ) : null}
                </div>
              ) : null}
              {panelData.maintenance_financial_acknowledgement_required ? (
                <div className="grid gap-2 rounded-lg border border-[#f5d08a] bg-[#fff9eb] p-3 text-[0.86rem]">
                  <strong>Cobrança de dano pendente</strong>
                  {panelData.folio ? (
                    <p className="m-0">
                      Saldo do fólio:{" "}
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: panelData.folio.currency,
                      }).format(panelData.folio.balance)}
                    </p>
                  ) : (
                    <p className="m-0">
                      Existe uma pendência financeira vinculada; os valores
                      exigem permissão financeira.
                    </p>
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={maintenanceAcknowledged}
                      onChange={(event) =>
                        setMaintenanceAcknowledged(event.target.checked)
                      }
                    />{" "}
                    Declaro ciência da cobrança pendente; o checkout continuará
                    permitido.
                  </label>
                </div>
              ) : null}
              {panelData.eligibility.can_checkout ? (
                <p className="m-0 rounded-lg border border-[#b6e4cb] bg-[#f1fbf5] p-3 text-[0.86rem] text-[#176c43]">
                  Checkout liberado para esta estadia.
                </p>
              ) : (
                <p className="m-0 rounded-lg border border-[#f5d08a] bg-[#fff9eb] p-3 text-[0.86rem] text-[#8a5a00]">
                  {panelData.eligibility.checkout_block_reason ||
                    "Checkout nao permitido para esta estadia."}
                </p>
              )}
              {hasPendingAccountAction ? (
                <p
                  className="m-0 rounded-lg border border-[#f5d08a] bg-[#fff9eb] p-3 text-[0.86rem] text-[#8a5a00]"
                  role="status"
                >
                  Resolva os ajustes ou reembolsos pendentes antes do checkout.
                </p>
              ) : null}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={
                  isPending ||
                  !panelData.eligibility.can_checkout ||
                  Boolean(
                    panelData.maintenance_acknowledgement_required &&
                    !maintenanceAcknowledged,
                  ) ||
                  Boolean(
                    panelData.maintenance_financial_acknowledgement_required &&
                    !maintenanceAcknowledged,
                  ) ||
                  Boolean(balance > 0 && checkoutTenderTotal !== balance) ||
                  Boolean(
                    Number(accountData?.folio.refundable_credit || 0) > 0,
                  ) ||
                  hasPendingAccountAction
                }
                className={primaryButtonClassName}
              >
                Confirmar checkout
              </button>
            </PanelSection>
          </aside>
        </section>
      ) : null}
      {accountData?.checkout_record ? (
        <section
          className="pms-surface-card grid gap-4 print:border-0 print:shadow-none"
          data-usage-guide="stay-account-statement"
          aria-label="Extrato não fiscal"
        >
          <div className="flex items-start justify-between gap-3 print:hidden">
            <div>
              <h2 className="m-0 text-xl">Extrato não fiscal</h2>
              <p className="m-0 text-sm text-slate-600">
                Fechamento original imutável da estadia.
              </p>
            </div>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => window.print()}
            >
              Imprimir extrato
            </button>
          </div>
          <header>
            <strong>Quarto {accountData.room_number}</strong>
            <p className="m-0">
              Reserva{" "}
              {accountData.reservation_code || accountData.reservation_id} ·{" "}
              {accountData.guest_name || "Hóspede não informado"}
            </p>
            <p className="m-0 text-sm">
              Fechado em{" "}
              {new Date(
                accountData.checkout_record.checked_out_at,
              ).toLocaleString("pt-BR")}
            </p>
          </header>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Descrição</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {accountData.folio.entries.map((entry) => (
                <tr className="border-t border-slate-200" key={entry.id}>
                  <td className="py-2">{entry.description}</td>
                  <td className="text-right">
                    {entry.direction === "credit" ? "− " : ""}
                    {formatMoney(entry.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid gap-1 text-sm sm:grid-cols-2">
            <span>
              Hospedagem:{" "}
              {formatMoney(accountData.checkout_record.lodging_total)}
            </span>
            <span>
              Consumos:{" "}
              {formatMoney(accountData.checkout_record.consumption_total)}
            </span>
            <span>
              Pagamentos:{" "}
              {formatMoney(accountData.checkout_record.payment_total)}
            </span>
            <span>
              Cortesias:{" "}
              {formatMoney(accountData.checkout_record.courtesy_total)}
            </span>
            <span>
              Descontos:{" "}
              {formatMoney(accountData.checkout_record.discount_total)}
            </span>
            <span>
              Exceções reconhecidas:{" "}
              {accountData.checkout_record.exception_folio_entry_ids.length}
            </span>
          </div>
          {accountData.corrections.some(
            (item) =>
              item.requested_at > accountData.checkout_record!.checked_out_at,
          ) ? (
            <section>
              <h3>Correções após checkout</h3>
              <ul>
                {accountData.corrections
                  .filter(
                    (item) =>
                      item.requested_at >
                      accountData.checkout_record!.checked_out_at,
                  )
                  .map((item) => (
                    <li key={item.id}>
                      {item.reason} · {item.status} · −
                      {formatMoney(item.net_reduction)}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
          <small>Documento operacional sem valor fiscal.</small>
        </section>
      ) : null}
    </section>
  );
}
