import { describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertTrainingLocalApiUrl,
  baselineFingerprint,
  reusableLocalValidation,
  parseTrainingArguments,
  TRAINING_SCENARIOS,
} from "../../../../scripts/training.mjs";

describe("orquestrador local de treinamento", () => {
  // QA-096: cada `supabase status` deixava um módulo nativo no Temp; o pai já validou o destino.
  describe("validação reaproveitada", () => {
    it("usa a URL validada pelo processo pai", () => {
      expect(
        reusableLocalValidation({
          SUPABASE_LOCAL_VALIDATED_URL: "http://127.0.0.1:54321",
        }),
      ).toBe("http://127.0.0.1:54321");
    });

    it("consulta a CLI quando ninguém validou antes", () => {
      expect(reusableLocalValidation({})).toBeNull();
    });

    it("recusa uma URL herdada que não seja a local", () => {
      expect(() =>
        reusableLocalValidation({
          SUPABASE_LOCAL_VALIDATED_URL: "https://example.supabase.co",
        }),
      ).toThrow(/não ser o Supabase local/);
    });
  });

  describe("reset rápido", () => {
    it("só usa a restauração quando pedida", () => {
      expect(
        parseTrainingArguments(["reset", "--scenario", "orientation", "--yes"]),
      ).toMatchObject({ kind: "reset", fast: false });
      expect(
        parseTrainingArguments([
          "reset",
          "--scenario",
          "orientation",
          "--yes",
          "--fast",
        ]),
      ).toMatchObject({ kind: "reset", scenario: "orientation", fast: true });
    });

    it("muda a impressão digital quando migration ou seed mudam", () => {
      const root = mkdtempSync(join(tmpdir(), "training-baseline-"));
      try {
        mkdirSync(join(root, "supabase/migrations"), { recursive: true });
        writeFileSync(join(root, "supabase/seed.sql"), "select 1;");
        writeFileSync(join(root, "supabase/migrations/1_a.sql"), "select 2;");
        const original = baselineFingerprint(root);
        expect(baselineFingerprint(root)).toBe(original);

        writeFileSync(join(root, "supabase/migrations/1_a.sql"), "select 3;");
        const changedMigration = baselineFingerprint(root);
        expect(changedMigration).not.toBe(original);

        writeFileSync(join(root, "supabase/migrations/2_b.sql"), "select 4;");
        const addedMigration = baselineFingerprint(root);
        expect(addedMigration).not.toBe(changedMigration);

        writeFileSync(join(root, "supabase/seed.sql"), "select 5;");
        expect(baselineFingerprint(root)).not.toBe(addedMigration);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    // QA-100: o seed calcula datas com current_date; uma base de ontem traria as datas atrasadas um dia.
    it("muda a impressão digital quando o dia muda", () => {
      const root = mkdtempSync(join(tmpdir(), "training-baseline-"));
      try {
        mkdirSync(join(root, "supabase/migrations"), { recursive: true });
        writeFileSync(join(root, "supabase/seed.sql"), "select current_date;");
        const today = baselineFingerprint(root, "2026-11-07");
        expect(baselineFingerprint(root, "2026-11-07")).toBe(today);
        expect(baselineFingerprint(root, "2026-11-08")).not.toBe(today);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("usa o dia em UTC, o mesmo de current_date no banco local", () => {
      const root = mkdtempSync(join(tmpdir(), "training-baseline-"));
      try {
        mkdirSync(join(root, "supabase/migrations"), { recursive: true });
        writeFileSync(join(root, "supabase/seed.sql"), "select 1;");
        expect(baselineFingerprint(root)).toBe(
          baselineFingerprint(root, new Date().toISOString().slice(0, 10)),
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("ignora a diferença de fim de linha entre plataformas", () => {
      const root = mkdtempSync(join(tmpdir(), "training-baseline-"));
      try {
        mkdirSync(join(root, "supabase/migrations"), { recursive: true });
        writeFileSync(join(root, "supabase/seed.sql"), "a\nb\n");
        const unix = baselineFingerprint(root);
        writeFileSync(join(root, "supabase/seed.sql"), "a\r\nb\r\n");
        expect(baselineFingerprint(root)).toBe(unix);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

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
    ).toEqual({
      kind: "reset",
      scenario: "cash-close",
      yes: true,
      fast: false,
    });
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
