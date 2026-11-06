const STATUS: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Enviada",
  approved: "Aprovado",
  converted: "Convertida em pedido",
  fulfilled: "Atendida",
  canceled: "Cancelado",
  pending_approval: "Aguardando aprovação",
  issued: "Emitido",
  partially_received: "Recebido em parte",
  received: "Recebido",
  closed: "Encerrado",
  exception: "Com exceção",
  partially_paid: "Paga em parte",
  paid: "Paga",
};

const PRIORITY: Record<string, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  critical: "Crítica",
};

const known = (labels: Record<string, string>, code: unknown) => {
  const key = String(code ?? "");
  return Object.hasOwn(labels, key) ? labels[key] : undefined;
};

export function procurementStatusLabel(status: unknown): string {
  return known(STATUS, status) ?? "Situação desconhecida";
}

export function procurementPriorityLabel(priority: unknown): string {
  return known(PRIORITY, priority) ?? "Não informada";
}
