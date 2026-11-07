import { describe, expect, it } from "vitest";
import {
  windowNoticeFor,
  withWindowReason,
} from "../../../../src/app/dashboard/reservations/_components/stayWindowReason";

const eligibility = (
  checkin: string | null = null,
  checkout: string | null = null,
) => ({ checkin_window_notice: checkin, checkout_window_notice: checkout });

// QA-087: fora da janela, entrada e saída acontecem com motivo.
describe("motivo fora da janela", () => {
  it("escolhe o aviso da ação pedida", () => {
    const value = eligibility("Check-in fora do horário", "Saída antecipada");
    expect(windowNoticeFor("checkin", value)).toBe("Check-in fora do horário");
    expect(windowNoticeFor("checkout", value)).toBe("Saída antecipada");
    expect(windowNoticeFor("no-show", value)).toBeNull();
    expect(windowNoticeFor("checkin", undefined)).toBeNull();
  });

  it("dentro da janela mantém o pedido como está", () => {
    const payload = { override_reason: "Exceção" };
    expect(withWindowReason(payload, "checkin", eligibility(), "")).toEqual(
      payload,
    );
  });

  it("fora da janela acrescenta o motivo sem apagar o resto do pedido", () => {
    expect(
      withWindowReason(
        { maintenance_acknowledged_folio_entry_ids: ["entry-1"] },
        "checkout",
        eligibility(null, "Saída antecipada"),
        "  Voo antecipado  ",
      ),
    ).toEqual({
      maintenance_acknowledged_folio_entry_ids: ["entry-1"],
      window_reason: "Voo antecipado",
    });
  });

  it("fora da janela recusa o pedido sem motivo", () => {
    expect(() =>
      withWindowReason({}, "checkin", eligibility("Fora do horário"), "   "),
    ).toThrow("Informe o motivo do check-in fora do horário do hotel.");
    expect(() =>
      withWindowReason({}, "checkout", eligibility(null, "Antecipada"), ""),
    ).toThrow(
      "Informe o motivo da saída fora da data ou do horário previstos.",
    );
  });
});
