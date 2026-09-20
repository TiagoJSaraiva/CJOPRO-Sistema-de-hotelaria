import { describe, expect, it } from "vitest";
import {
  assertTrainingLocalApiUrl,
  parseTrainingArguments,
  TRAINING_SCENARIOS,
} from "../../../../scripts/training.mjs";

describe("orquestrador local de treinamento", () => {
  it("aceita somente a API local do Supabase", () => {
    expect(assertTrainingLocalApiUrl("http://127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321",
    );
    expect(() =>
      assertTrainingLocalApiUrl("https://example.supabase.co"),
    ).toThrow(/não ser o Supabase local/);
    expect(() => assertTrainingLocalApiUrl("http://127.0.0.1:54322")).toThrow(
      /não ser o Supabase local/,
    );
  });

  it("interpreta reset e ações de relógio sem aceitar um cenário arbitrário", () => {
    expect(
      parseTrainingArguments(["reset", "--scenario", "cash-close", "--yes"]),
    ).toEqual({ kind: "reset", scenario: "cash-close", yes: true });
    expect(parseTrainingArguments(["clock", "advance", "2", "days"])).toEqual({
      kind: "clock",
      action: "advance",
      amount: 2,
      unit: "days",
    });
    expect(TRAINING_SCENARIOS.map(([key]) => key)).toContain(
      "integrated-shift",
    );
  });
});
