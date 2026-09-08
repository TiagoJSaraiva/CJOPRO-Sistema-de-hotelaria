import { describe, expect, it } from "vitest";
import {
  maintenanceActions,
  maintenanceDecisionError,
  maintenanceEventLabel,
} from "../src/maintenance-actions";
describe("ações operacionais", () => {
  it("seleciona transições por estado e autorização", () => {
    expect(maintenanceActions("pending", true, false)).toEqual([
      "assign",
      "cancel",
    ]);
    expect(maintenanceActions("assigned", false, true)).toEqual([
      "start",
      "cancel",
    ]);
    expect(maintenanceActions("waiting", false, true)).toEqual([
      "resume",
      "cancel",
    ]);
    expect(maintenanceActions("paused", true, false)).toEqual([
      "resume",
      "assign",
      "cancel",
    ]);
    expect(maintenanceActions("in_progress", false, true)).toEqual([
      "pause",
      "wait",
      "complete",
      "cancel",
    ]);
    expect(maintenanceActions("awaiting_inspection", true, true)).toEqual([]);
    expect(maintenanceActions("completed", true, false)).toEqual(["reopen"]);
    expect(maintenanceActions("canceled", true, true)).toEqual([]);
    expect(maintenanceActions("in_progress", false, false)).toEqual([]);
  });
  it("exige decisões reais e categorias conhecidas", () => {
    for (const action of ["pause", "wait", "complete", "cancel", "reopen"])
      expect(maintenanceDecisionError({ action, notes: "  " })).toBeTruthy();
    expect(
      maintenanceDecisionError({
        action: "complete",
        notes: "Troca realizada",
      }),
    ).toBe("Informe o diagnóstico.");
    expect(
      maintenanceDecisionError({
        action: "wait",
        notes: "Peça encomendada",
        waiting_reason: "invalid",
      }),
    ).toBeTruthy();
    expect(
      maintenanceDecisionError({
        action: "wait",
        notes: "Peça encomendada",
        waiting_reason: "parts",
      }),
    ).toBeNull();
    expect(
      maintenanceDecisionError({
        action: "complete",
        notes: "Troca realizada",
        diagnosis: "Curto",
      }),
    ).toBeNull();
    expect(maintenanceDecisionError({ action: "resume" })).toBeNull();
  });
  it("traduz histórico sem expor eventos técnicos desconhecidos", () => {
    expect(maintenanceEventLabel("occurrence_created")).toBe(
      "Ocorrência registrada",
    );
    expect(maintenanceEventLabel("work_order_resume")).toBe("Retomar serviço");
    expect(maintenanceEventLabel("occurrence_reported")).toBe(
      "Ocorrência registrada",
    );
    expect(maintenanceEventLabel("work_order_started")).toBe(
      "Serviço iniciado",
    );
    expect(maintenanceEventLabel("future_event")).toBe(
      "Atualização do atendimento",
    );
  });
});
