import { describe, expect, it } from "vitest";
import {
  procurementPriorityLabel,
  procurementStatusLabel,
} from "../../../src/app/dashboard/procurement/procurementLabels";

describe("compras em português", () => {
  it.each([
    ["draft", "Rascunho"],
    ["pending_approval", "Aguardando aprovação"],
    ["partially_received", "Recebido em parte"],
    ["exception", "Com exceção"],
    ["paid", "Paga"],
  ])("%s vira %s", (code, label) => {
    expect(procurementStatusLabel(code)).toBe(label);
  });

  it("prioridade conhecida", () => {
    expect(procurementPriorityLabel("high")).toBe("Alta");
  });

  it.each([undefined, null, "x_y", "constructor"])(
    "%s não aparece cru",
    (code) => {
      expect(procurementStatusLabel(code)).toBe("Situação desconhecida");
      expect(procurementPriorityLabel(code)).toBe("Não informada");
    },
  );
});
