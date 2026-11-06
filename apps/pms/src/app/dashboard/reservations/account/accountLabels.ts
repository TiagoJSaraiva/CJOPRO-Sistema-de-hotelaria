import type {
  AdminStayAccount,
  ConsumptionBillingMode,
  ConsumptionPaymentMethod,
} from "@hotel/shared";

type StayAccountOrder = AdminStayAccount["consumption_orders"][number];
type FolioEntry = AdminStayAccount["folio"]["entries"][number];

const ACCOUNT_STATUS_LABELS: Record<AdminStayAccount["status"], string> = {
  open: "Em aberto",
  ready_to_checkout: "Pronta para checkout",
  closed: "Encerrada",
  closed_with_exception: "Encerrada com exceção",
  closed_with_pending_refund: "Encerrada com reembolso pendente",
};

const FOLIO_KIND_LABELS: Record<FolioEntry["kind"], string> = {
  lodging: "Hospedagem",
  maintenance_charge: "Cobrança de manutenção",
  consumption_charge: "Consumo",
  payment: "Pagamento",
  refund: "Reembolso",
  adjustment: "Ajuste",
};

const BILLING_MODE_LABELS: Record<ConsumptionBillingMode, string> = {
  hotel_immediate: "Pagamento imediato ao hotel",
  stay_folio: "Lançamento no fólio",
  partner_direct: "Pagamento direto ao parceiro",
};

const ORDER_STATUS_LABELS: Record<
  NonNullable<StayAccountOrder["effective_status"]>,
  string
> = {
  active: "Ativa",
  correction_pending: "Correção pendente",
  refund_pending: "Reembolso pendente",
  partner_refund_pending: "Reembolso do parceiro pendente",
  adjusted: "Ajustada",
  voided: "Anulada",
  legacy: "Migrado sem forma de cobrança",
};

const CORRECTION_STATUS_LABELS: Record<
  AdminStayAccount["corrections"][number]["status"],
  string
> = {
  pending: "Aguardando aprovação",
  approved: "Aprovada",
  rejected: "Rejeitada",
  awaiting_refund: "Aguardando reembolso",
  awaiting_partner_refund: "Aguardando reembolso do parceiro",
  completed: "Concluída",
};

const PAYMENT_METHOD_LABELS: Record<ConsumptionPaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  bank_transfer: "Transferência bancária",
};

export function accountStatusLabel(status: AdminStayAccount["status"]): string {
  return ACCOUNT_STATUS_LABELS[status];
}

export function folioKindLabel(kind: FolioEntry["kind"]): string {
  return FOLIO_KIND_LABELS[kind];
}

export function correctionStatusLabel(
  status: AdminStayAccount["corrections"][number]["status"],
): string {
  return CORRECTION_STATUS_LABELS[status];
}

export function paymentMethodLabel(method: ConsumptionPaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method];
}

export function effectiveStatusLabel(
  status: StayAccountOrder["effective_status"],
): string {
  return ORDER_STATUS_LABELS[status || "active"];
}

/** Comanda em vigor mostra como foi cobrada; as demais, sua situação. */
export function orderSituationLabel(order: StayAccountOrder): string {
  const status = order.effective_status;
  if ((!status || status === "active") && order.billing_mode) {
    return BILLING_MODE_LABELS[order.billing_mode];
  }
  if (status) return ORDER_STATUS_LABELS[status];
  return order.disposition === "courtesy"
    ? "Cortesia"
    : ORDER_STATUS_LABELS.active;
}

const ACTION_MESSAGES: Record<
  string,
  { tone: "success" | "error"; text: string }
> = {
  refunded: { tone: "success", text: "Reembolso registrado." },
  "payment-reversed": { tone: "success", text: "Pagamento estornado." },
  forbidden: { tone: "error", text: "Sem permissão para esta ação." },
  invalid: { tone: "error", text: "Confira os dados informados." },
  "version-conflict": {
    tone: "error",
    text: "A conta mudou enquanto você trabalhava. Confira os valores e tente de novo.",
  },
  conflict: {
    tone: "error",
    text: "Não foi possível concluir a ação nesta conta.",
  },
};

/** Valor desconhecido no endereço não vira texto na tela. */
export function accountActionMessage(status: string | undefined) {
  return status && Object.hasOwn(ACTION_MESSAGES, status)
    ? ACTION_MESSAGES[status]
    : null;
}
