import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

  it("interpreta a verificação de um cenário e da matriz completa", () => {
    expect(
      parseTrainingArguments(["verify", "--scenario", "orientation"]),
    ).toEqual({ kind: "verify", scenario: "orientation", all: false });
    expect(parseTrainingArguments(["verify", "--all"])).toEqual({
      kind: "verify",
      scenario: undefined,
      all: true,
    });
  });

  it("mantém fixture e contrato de verificação para cada cenário público", () => {
    const root = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../..",
    );
    for (const [scenario] of TRAINING_SCENARIOS) {
      const fixture = resolve(
        root,
        "supabase/training/scenarios",
        `${scenario}.sql`,
      );
      const verification = resolve(
        root,
        "supabase/training/verification",
        `${scenario}.sql`,
      );
      expect(existsSync(fixture), `${scenario}: fixture ausente`).toBe(true);
      expect(existsSync(verification), `${scenario}: verificação ausente`).toBe(
        true,
      );
      expect(readFileSync(fixture, "utf8")).toContain(
        "prepare_training_scenario",
      );
      expect(readFileSync(verification, "utf8")).toContain(
        "assert_training_scenario",
      );
    }
  });
});
