const SESSION_STATUS: Record<string, string> = {
  open: "aberta",
  counting: "em contagem",
  difference_pending: "com diferença pendente",
  closed: "encerrada",
  canceled: "cancelada",
};

const DAILY_CLOSE_STATUS: Record<string, string> = {
  open: "Em aberto",
  prepared: "Preparado",
  closed: "Fechado",
  rejected: "Devolvido",
};

const MOVEMENT_KIND: Record<string, string> = {
  opening_float: "Fundo inicial",
  receipt: "Recebimentos",
  refund: "Reembolsos",
  cash_in: "Suprimento",
  cash_out: "Retirada",
  deposit: "Depósito",
  adjustment: "Ajuste",
};

export function cashSessionStatusLabel(status: string): string {
  return SESSION_STATUS[status] ?? "em situação desconhecida";
}

export function dailyCloseStatusLabel(status: string): string {
  return DAILY_CLOSE_STATUS[status] ?? "Situação desconhecida";
}

export function cashMovementLabel(kind: string): string {
  return MOVEMENT_KIND[kind] ?? "Outro movimento";
}

export type CashOutcome = { tone: "success" | "error"; message: string };

const OUTCOMES: Record<string, CashOutcome> = {
  created: { tone: "success", message: "Caixa cadastrado." },
  opened: { tone: "success", message: "Sessão aberta." },
  moved: { tone: "success", message: "Movimento registrado." },
  counted: { tone: "success", message: "Contagem registrada." },
  decided: { tone: "success", message: "Decisão registrada." },
  prepared: {
    tone: "success",
    message: "Fechamento preparado. Agora outra pessoa precisa aprovar.",
  },
  closed: { tone: "success", message: "Dia fechado." },
  returned: {
    tone: "success",
    message: "Fechamento devolvido para nova preparação.",
  },
  active_session_exists: {
    tone: "error",
    message: "Este caixa já tem uma sessão aberta.",
  },
  code_exists: {
    tone: "error",
    message: "Já existe um caixa com este código.",
  },
  conflict: {
    tone: "error",
    message:
      "Os dados mudaram enquanto você operava. Confira a tela e tente de novo.",
  },
  insufficient_cash: {
    tone: "error",
    message: "O movimento deixaria o caixa com valor negativo.",
  },
  count_required: { tone: "error", message: "Informe o valor contado." },
  reason_required: { tone: "error", message: "Informe o motivo." },
  session_not_operable: {
    tone: "error",
    message: "Esta sessão não pode receber esta operação.",
  },
  segregation_required: {
    tone: "error",
    message: "Esta decisão precisa ser tomada por outra pessoa.",
  },
  blocking_items: {
    tone: "error",
    message:
      "O dia tem impedimentos. Resolva os itens listados antes de preparar.",
  },
  projection_changed: {
    tone: "error",
    message:
      "Os dados do dia mudaram depois da preparação. Devolva o fechamento para que seja preparado de novo.",
  },
  invalid_transition: {
    tone: "error",
    message: "Esta operação não vale para a situação atual.",
  },
  not_found: { tone: "error", message: "Registro não encontrado neste hotel." },
};

const UNKNOWN_FAILURE: CashOutcome = {
  tone: "error",
  message: "Não foi possível concluir a operação.",
};

export function cashOutcome(status: string): CashOutcome {
  return Object.hasOwn(OUTCOMES, status) ? OUTCOMES[status]! : UNKNOWN_FAILURE;
}
