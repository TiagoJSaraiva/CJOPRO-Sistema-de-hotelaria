import { describe, expect, it } from "vitest";
import {
  disputeStateLabel,
  disputeStatusLabel,
  paymentStateLabel,
  settlementEventLabel,
  settlementOutcome,
} from "../../../../src/app/dashboard/consumption/settlements/settlementLabels";

describe("resultado da operação", () => {
  it("sucesso aparece como sucesso", () => {
    expect(settlementOutcome("approved")).toEqual({
      tone: "success",
      message: "Apuração aprovada.",
    });
  });

  it("recusa do banco aparece como falha, com o motivo", () => {
    const outcome = settlementOutcome("settlement_self_approval");
    expect(outcome.tone).toBe("error");
    expect(outcome.message).toContain("Quem preparou");
  });

  it("código desconhecido nunca aparece como sucesso nem é ecoado", () => {
    for (const code of ["codigo_novo", "constructor", "__proto__"]) {
      const outcome = settlementOutcome(code);
      expect(outcome.tone).toBe("error");
      expect(outcome.message).toBe("Não foi possível concluir a operação.");
    }
  });
});

describe("rótulos", () => {
  it("traduz os estados conhecidos", () => {
    expect(disputeStatusLabel("open")).toBe("Aberta");
    expect(disputeStatusLabel("accepted")).toBe("Aceita");
    expect(paymentStateLabel("partially_settled")).toBe(
      "Parcialmente liquidada",
    );
    expect(disputeStateLabel("disputed")).toBe("Em contestação");
    expect(settlementEventLabel("dispute_accept")).toBe("Contestação aceita");
  });

  it("valor novo do banco não aparece cru", () => {
    expect(disputeStatusLabel("novo")).toBe("Situação desconhecida");
    expect(paymentStateLabel("novo")).toBe("Situação desconhecida");
    expect(disputeStateLabel("novo")).toBe("Situação desconhecida");
    expect(settlementEventLabel("novo")).toBe("Evento registrado");
  });
});
