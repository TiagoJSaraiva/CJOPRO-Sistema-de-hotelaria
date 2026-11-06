const EVENT_TYPE: Record<string, string> = {
  create: "Nova reserva",
  amend: "Alteração de reserva",
  cancel: "Cancelamento",
};

const EVENT_STATUS: Record<string, string> = {
  received: "Aguardando decisão",
  needs_review: "Em revisão",
  applied: "Aplicado",
  rejected: "Rejeitado",
  duplicate: "Duplicado",
};

const EVENT_REASON: Record<string, string> = {
  mapping_missing:
    "Categoria ou tarifa sem mapeamento. Crie o mapeamento e aplique de novo.",
  inventory_conflict:
    "Sem disponibilidade na categoria para o período. Libere um quarto ou rejeite.",
  past_dates:
    "O período já passou, e o evento não pode virar reserva. Confirme com o canal e rejeite.",
};

const known = (labels: Record<string, string>, code: string) =>
  Object.hasOwn(labels, code) ? labels[code] : undefined;

export function channelEventTypeLabel(type: string): string {
  return known(EVENT_TYPE, type) ?? "Evento";
}

export function channelEventStatusLabel(status: string): string {
  return known(EVENT_STATUS, status) ?? "Situação desconhecida";
}

/** O motivo é um código do sistema ou o texto que a pessoa digitou ao decidir. */
export function channelEventReasonLabel(reason: string): string {
  return known(EVENT_REASON, reason) ?? reason;
}

export function channelEventAwaitsDecision(status: string): boolean {
  return status === "received" || status === "needs_review";
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

const CSV_HEADER =
  "event_id,event_type,external_reservation_id,occurred_at,room_code,rate_code,checkin_date,checkout_date,adults,children,currency,total,guest_name,guest_email,guest_phone";

/** A amostra acompanha a data do hotel: com datas fixas, ela acabaria descrevendo o passado. */
export function channelCsvSample(operationalDate: string): string {
  return [
    CSV_HEADER,
    [
      "HL-001",
      "create",
      "RES-001",
      `${operationalDate}T12:00:00Z`,
      "STD",
      "FLEX",
      addDays(operationalDate, 14),
      addDays(operationalDate, 16),
      "2",
      "0",
      "BRL",
      "500",
      "Hóspede Exemplo",
      "guest@example.invalid",
      "+551100000000",
    ].join(","),
  ].join("\n");
}
