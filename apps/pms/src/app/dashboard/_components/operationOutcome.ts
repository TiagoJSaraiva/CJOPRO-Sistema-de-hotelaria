export type OperationOutcome = {
  tone: "success" | "error" | "notice";
  message: string;
};

const success = (message: string): OperationOutcome => ({
  tone: "success",
  message,
});
const failure = (message: string): OperationOutcome => ({
  tone: "error",
  message,
});

const OUTCOMES: Record<string, OperationOutcome> = {
  created: success("Registro criado."),
  updated: success("Alteração salva."),
  "policy-saved": success("Política de compras salva."),
  "order-created": success("Pedido de compra criado."),
  "receipt-created": success("Recebimento registrado."),
  "invoice-created": success("Nota registrada."),
  "invoice-updated": success("Nota atualizada."),
  "payment-created": success("Pagamento registrado."),
  "reservation-customer-linked": success("Hóspede identificado na reserva."),
  "reservation-room-assigned": success(
    "Quarto alocado. A reserva já aparece no calendário.",
  ),
  "reservation-canceled": success("Reserva cancelada."),
  "customer-required": failure(
    "Identifique o hóspede antes de alocar o quarto.",
  ),
  "hold-not-confirmed": failure(
    "Registre o adiantamento para confirmar a pré-reserva antes de alocar o quarto.",
  ),
  "customer-document-exists": failure(
    "Já existe cliente com esse documento neste hotel. Escolha-o na lista.",
  ),
  "customer-invalid": failure("Esse cliente não pertence a este hotel."),
  "stay-account-open": failure(
    "A conta da estadia tem pagamento ou consumo. Acerte a conta antes de encerrar.",
  ),
  "booking-configuration-saved": success(
    "Configuração de venda direta atualizada.",
  ),
  "channel-mapping-saved": success("Mapeamento salvo."),
  "channel-event-updated": success("Evento de canal atualizado."),
  "channel-csv-imported": success("Arquivo importado para a caixa de entrada."),
  "prearrival-updated": success("Solicitação atualizada."),
  "analytics-reconciled": success("Indicadores reconciliados."),
  "preference-created": success("Preferência declarada registrada."),
  "training-clock-updated": success("Relógio operacional atualizado."),
  approved: success("Ajuste aprovado."),
  rejected: success("Ajuste rejeitado."),
  "void-requested": success("Pedido de anulação enviado para aprovação."),
  "adjustment-requested": success("Pedido de ajuste enviado para aprovação."),
  "partner-refund-confirmed": success("Devolução do parceiro confirmada."),

  invalid: failure("Revise os campos informados e tente de novo."),
  forbidden: failure("Você não tem permissão para esta ação."),
  "not-found": failure("O registro não foi encontrado neste hotel."),
  conflict: failure(
    "A operação não foi concluída: ela conflita com o estado atual dos dados. Confira e tente de novo.",
  ),
  "version-conflict": failure(
    "Os dados mudaram enquanto você trabalhava. Atualize a tela e repita a operação.",
  ),
  "self-approval": failure(
    "Quem pediu o ajuste não pode aprová-lo. Outra pessoa precisa decidir.",
  ),
  "cash-session-required": failure(
    "Dinheiro exige uma sessão de caixa aberta por você. Abra a sessão em Caixa e tente de novo.",
  ),
  "quantity-exceeded": failure(
    "A quantidade não cabe no saldo do pedido. Confira o que já foi recebido e corrija; nada foi movimentado.",
  ),
  "insufficient-stock": failure(
    "O saldo por lote não cobre a quantidade. Nada foi movimentado.",
  ),
  "stock-changed": failure(
    "O saldo do estoque mudou e não cobre a rota. Nada foi movimentado: confira o estoque e tente de novo.",
  ),
  "channel-mapping-missing": failure(
    "O evento continua em revisão: falta mapear a categoria ou a tarifa.",
  ),
  "channel-no-availability": failure(
    "O evento continua em revisão: não há disponibilidade para o período.",
  ),
  "channel-past-dates": failure(
    "O evento continua em revisão: o período já passou e não pode virar reserva.",
  ),
  unavailable: failure(
    "A operação não foi concluída porque o sistema não respondeu como esperado. Tente de novo.",
  ),
};

// O código vem da URL: um valor desconhecido nunca aparece cru nem é apresentado como sucesso.
const UNKNOWN: OperationOutcome = {
  tone: "notice",
  message:
    "Não foi possível identificar o resultado da operação. Confira os dados na tela.",
};

export function operationOutcome(
  status?: string | null,
  local: Record<string, OperationOutcome> = {},
): OperationOutcome | null {
  if (!status) return null;
  const own = Object.hasOwn(local, status) ? local[status] : undefined;
  const known = Object.hasOwn(OUTCOMES, status) ? OUTCOMES[status] : undefined;
  return own ?? known ?? UNKNOWN;
}

const DETAILS: Record<string, string> = {
  version_conflict: "version-conflict",
  cash_session_required: "cash-session-required",
  self_approval: "self-approval",
  invalid_quantity: "quantity-exceeded",
  stock_changed: "stock-changed",
  insufficient_fefo_stock: "insufficient-stock",
  insufficient_explicit_lot_stock: "insufficient-stock",
  mapping_missing: "channel-mapping-missing",
  inventory_conflict: "channel-no-availability",
  past_dates: "channel-past-dates",
  customer_required: "customer-required",
  hold_not_confirmed: "hold-not-confirmed",
  customer_document_exists: "customer-document-exists",
  invalid_customer: "customer-invalid",
  open_account: "stay-account-open",
};
const STATUS_CODES: Record<number, string> = {
  400: "invalid",
  403: "forbidden",
  404: "not-found",
  409: "conflict",
};

/** Traduz a falha de uma chamada ao backend no código que a tela sabe explicar. */
export function failureStatus(error: unknown): string {
  const { details, statusCode } = (error ?? {}) as {
    details?: string;
    statusCode?: number;
  };
  const known =
    details && Object.hasOwn(DETAILS, details) ? DETAILS[details] : undefined;
  return (
    known ??
    (statusCode ? STATUS_CODES[statusCode] : undefined) ??
    "unavailable"
  );
}
