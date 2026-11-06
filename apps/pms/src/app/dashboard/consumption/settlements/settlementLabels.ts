const DISPUTE_STATUS: Record<string, string> = {
  open: "Aberta",
  accepted: "Aceita",
  rejected: "Rejeitada",
  canceled: "Cancelada",
};

const PAYMENT_STATE: Record<string, string> = {
  open: "Em aberto",
  partially_settled: "Parcialmente liquidada",
  settled: "Liquidada",
};

const DISPUTE_STATE: Record<string, string> = {
  clear: "Sem contestação",
  disputed: "Em contestação",
  resolved: "Contestação resolvida",
};

const EVENT_ACTION: Record<string, string> = {
  calculated: "Cálculo",
  submitted: "Envio para revisão",
  approved: "Aprovação",
  rejected: "Rejeição",
  payment_recorded: "Baixa registrada",
  partial_payment: "Baixa parcial",
  payment_reversed: "Estorno de baixa",
  settled: "Quitação",
  dispute_opened: "Contestação aberta",
  dispute_accept: "Contestação aceita",
  dispute_reject: "Contestação rejeitada",
  dispute_cancel: "Contestação cancelada",
};

export function disputeStatusLabel(status: string): string {
  return DISPUTE_STATUS[status] ?? "Situação desconhecida";
}

export function paymentStateLabel(state: string): string {
  return PAYMENT_STATE[state] ?? "Situação desconhecida";
}

export function disputeStateLabel(state: string): string {
  return DISPUTE_STATE[state] ?? "Situação desconhecida";
}

export function settlementEventLabel(action: string): string {
  return EVENT_ACTION[action] ?? "Evento registrado";
}

export type SettlementOutcome = { tone: "success" | "error"; message: string };

const success = (message: string): SettlementOutcome => ({
  tone: "success",
  message,
});
const failure = (message: string): SettlementOutcome => ({
  tone: "error",
  message,
});

const OUTCOMES: Record<string, SettlementOutcome> = {
  created: success("Apuração gerada."),
  recalculated: success("Apuração recalculada com as fontes atuais."),
  submitted: success("Apuração enviada para revisão por outra pessoa."),
  approved: success("Apuração aprovada."),
  rejected: success("Apuração rejeitada e devolvida ao rascunho."),
  disputed: success("Contestação aberta."),
  "dispute-decided": success("Decisão da contestação registrada."),
  "payment-recorded": success("Baixa registrada."),
  "payment-reversed": success("Baixa estornada."),
  settled: success("Apuração quitada."),
  "settings-updated": success("Parâmetros atualizados."),
  forbidden: failure("Sua conta não tem permissão para esta operação."),
  conflict: failure(
    "Os dados mudaram enquanto você operava. Confira a tela e tente de novo.",
  ),
  settlement_version_conflict: failure(
    "A apuração mudou depois que você abriu esta tela. Confira a versão atual e tente de novo.",
  ),
  settlement_self_approval: failure(
    "Quem preparou a apuração não pode aprová-la.",
  ),
  settlement_sources_changed: failure(
    "As fontes da apuração mudaram. Recalcule antes de seguir.",
  ),
  settlement_pending_corrections: failure(
    "Há correção ou reembolso pendente nas fontes. Resolva antes de aprovar.",
  ),
  settlement_month_still_open: failure("Só é possível apurar mês encerrado."),
  settlement_invalid_state: failure(
    "Esta operação não vale para a situação atual da apuração.",
  ),
  settlement_already_exists: failure("A apuração deste mês já existe."),
  settlement_payment_mismatch: failure(
    "O valor não corresponde ao saldo da apuração.",
  ),
  invalid_amount: failure(
    "O valor passa do saldo liquidável, que não inclui valores contestados nem já pagos.",
  ),
  invalid_status: failure(
    "Esta operação não vale para a situação atual da apuração.",
  ),
  invalid_transition: failure(
    "Esta operação não vale para a situação atual da contestação.",
  ),
  cash_session_required: failure(
    "Pagamento em dinheiro exige uma sessão de caixa aberta.",
  ),
  period_before_tracking: failure(
    "O mês é anterior ao início do acompanhamento das apurações.",
  ),
  reason_required: failure("Informe o motivo."),
  invalid_decision: failure("Escolha aprovar ou rejeitar."),
  payment_already_reversed: failure("Esta baixa já foi estornada."),
};

const UNKNOWN_FAILURE = failure("Não foi possível concluir a operação.");

export function settlementOutcome(status: string): SettlementOutcome {
  return Object.hasOwn(OUTCOMES, status) ? OUTCOMES[status]! : UNKNOWN_FAILURE;
}
