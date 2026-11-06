import { describe, expect, it } from "vitest";
import {
  channelCsvSample,
  channelEventAwaitsDecision,
  channelEventReasonLabel,
  channelEventStatusLabel,
  channelEventTypeLabel,
} from "../../../../src/app/dashboard/reservations/channels/channelLabels";

describe("eventos de canal", () => {
  it("não mostra códigos crus", () => {
    expect(channelEventTypeLabel("create")).toBe("Nova reserva");
    expect(channelEventStatusLabel("needs_review")).toBe("Em revisão");
    expect(channelEventReasonLabel("mapping_missing")).toContain("mapeamento");
    expect(channelEventReasonLabel("past_dates")).toContain("já passou");
  });

  it("código desconhecido não aparece cru", () => {
    expect(channelEventTypeLabel("x_y")).toBe("Evento");
    expect(channelEventStatusLabel("x_y")).toBe("Situação desconhecida");
    expect(channelEventStatusLabel("constructor")).toBe(
      "Situação desconhecida",
    );
  });

  it("mantém o motivo que a pessoa digitou", () => {
    expect(channelEventReasonLabel("Reserva conferida")).toBe(
      "Reserva conferida",
    );
  });

  it.each([
    ["received", true],
    ["needs_review", true],
    ["applied", false],
    ["rejected", false],
    ["duplicate", false],
  ])("%s aguarda decisão: %s", (status, expected) => {
    expect(channelEventAwaitsDecision(status)).toBe(expected);
  });
});

describe("amostra de CSV", () => {
  it("usa datas futuras em relação à data do hotel", () => {
    const [header, line] = channelCsvSample("2026-12-25").split("\n");
    expect(header).toContain("checkin_date,checkout_date");
    expect(line).toContain("2026-12-25T12:00:00Z");
    expect(line).toContain("2027-01-08,2027-01-10");
  });
});
