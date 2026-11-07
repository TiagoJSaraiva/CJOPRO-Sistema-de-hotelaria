import { ADMIN_ERROR_CODE, adminError } from "./adminError";

const RULE_MESSAGES: Record<string, string> = {
  cash_session_required:
    "Dinheiro exige uma sessão de caixa aberta por você. Abra a sessão em Caixa e tente de novo.",
  cash_session_not_open: "A sessão de caixa informada não está aberta.",
  insufficient_fefo_stock:
    "O saldo por lote não cobre a quantidade. Nada foi movimentado.",
  insufficient_explicit_lot_stock:
    "O lote escolhido não tem saldo para a quantidade. Nada foi movimentado.",
  expiry_required: "Este produto exige um lote com validade.",
  cash_transaction_immutable:
    "Um movimento em dinheiro não muda depois de entrar no caixa. Use uma operação compensatória.",
  closed_day_immutable:
    "Este lançamento pertence a um dia já fechado e não muda. Registre um novo lançamento para corrigir.",
};

function ruleCode(error: unknown): string | null {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && Object.hasOwn(RULE_MESSAGES, message)
    ? message
    : null;
}

/**
 * Gatilhos do banco aplicam regras em todos os caminhos, como dinheiro fora da sessão ou saída maior
 * que o saldo por lote. Esta resposta evita que a recusa chegue à tela como erro interno.
 */
export function databaseRuleError(error: unknown) {
  const code = ruleCode(error);
  return code
    ? adminError(ADMIN_ERROR_CODE.CONFLICT, RULE_MESSAGES[code]!, code)
    : null;
}
