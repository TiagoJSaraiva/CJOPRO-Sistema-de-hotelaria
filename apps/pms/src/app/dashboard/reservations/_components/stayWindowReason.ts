import type { AdminStayOperationalPanelResponse } from "@hotel/shared";

type WindowEligibility = Pick<
  AdminStayOperationalPanelResponse["eligibility"],
  "checkin_window_notice" | "checkout_window_notice"
>;

const MISSING_REASON = {
  checkin: "Informe o motivo do check-in fora do horário do hotel.",
  checkout: "Informe o motivo da saída fora da data ou do horário previstos.",
} as const;

/** Aviso da janela para a ação; só entrada e saída têm janela (QA-087). */
export function windowNoticeFor(
  action: string,
  eligibility: WindowEligibility | undefined,
): string | null {
  if (action === "checkin") return eligibility?.checkin_window_notice ?? null;
  if (action === "checkout") return eligibility?.checkout_window_notice ?? null;
  return null;
}

/** Fora da janela, a ação só segue com o motivo, que vai junto do restante do pedido. */
export function withWindowReason(
  payload: Record<string, unknown>,
  action: string,
  eligibility: WindowEligibility | undefined,
  reason: string,
): Record<string, unknown> {
  if (!windowNoticeFor(action, eligibility)) return payload;
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error(MISSING_REASON[action as keyof typeof MISSING_REASON]);
  }
  return { ...payload, window_reason: trimmed };
}
