import { describe, expect, it } from "vitest";
import {
  buildJourneyEnvironment,
  journeyPhases,
  parseJourneyArguments,
} from "../../../../scripts/journeys.mjs";

describe("executor das jornadas no sistema real", () => {
  const credentials = {
    apiUrl: "http://127.0.0.1:54321",
    serviceRoleKey: "chave-local-sintetica",
  };

  it("fornece credenciais locais aos serviços e liga o treinamento", () => {
    const environment = buildJourneyEnvironment(credentials, { KEEP: "sim" });

    expect(environment).toMatchObject({
      KEEP: "sim",
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SECRET_KEY: "chave-local-sintetica",
      SUPABASE_SERVICE_ROLE_KEY: "chave-local-sintetica",
      LOCAL_TRAINING_ENABLED: "true",
    });
    expect(environment.AUTH_SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("repassa a URL já validada para os subprocessos não consultarem a CLI de novo", () => {
    expect(
      buildJourneyEnvironment(credentials, {}).SUPABASE_LOCAL_VALIDATED_URL,
    ).toBe("http://127.0.0.1:54321");
  });

  it("sobrescreve um destino herdado do ambiente", () => {
    const environment = buildJourneyEnvironment(credentials, {
      SUPABASE_URL: "https://example.supabase.co",
    });

    expect(environment.SUPABASE_URL).toBe("http://127.0.0.1:54321");
  });

  it("recusa qualquer Supabase que não seja o local", () => {
    for (const apiUrl of [
      "https://example.supabase.co",
      "http://127.0.0.1:54322",
      "https://127.0.0.1:54321",
    ]) {
      expect(() =>
        buildJourneyEnvironment({ ...credentials, apiUrl }, {}),
      ).toThrow(/nao local/);
    }
  });

  it("recusa executar sem a chave local", () => {
    expect(() =>
      buildJourneyEnvironment({ ...credentials, serviceRoleKey: "" }, {}),
    ).toThrow(/chave local/);
  });

  it("repassa filtros ao Playwright sem o separador do pnpm", () => {
    expect(parseJourneyArguments(["--", "--grep", "lição 1"])).toEqual([
      "--grep",
      "lição 1",
    ]);
    expect(parseJourneyArguments([])).toEqual([]);
  });

  describe("fases da execução", () => {
    it("roda jornadas em dev e a varredura em produção sem filtro", () => {
      expect(journeyPhases([])).toEqual(["development", "production"]);
    });

    it("não compila o PMS para uma jornada pedida pelo caminho", () => {
      expect(
        journeyPhases(["__tests__/journeys/lesson-01-orientation.spec.ts"]),
      ).toEqual(["development"]);
    });

    it("roda só produção quando o caminho é o da varredura", () => {
      expect(
        journeyPhases(["__tests__\\journeys\\sweep-pages.spec.ts"]),
      ).toEqual(["production"]);
    });

    it("roda as duas fases quando os caminhos misturam os dois tipos", () => {
      expect(
        journeyPhases([
          "__tests__/journeys/lesson-01-orientation.spec.ts",
          "__tests__/journeys/sweep-pages.spec.ts",
        ]),
      ).toEqual(["development", "production"]);
    });

    it("só compila o PMS se o filtro de nome puder chegar à varredura", () => {
      expect(journeyPhases(["--grep", "lição 1"])).toEqual(["development"]);
      expect(journeyPhases(["-g", "lição 1"])).toEqual(["development"]);
      expect(journeyPhases(["--grep=lição 1"])).toEqual(["development"]);
      expect(journeyPhases(["--grep", "varredura"])).toEqual([
        "development",
        "production",
      ]);
      expect(journeyPhases(["-g", "varredura: admin"])).toEqual([
        "development",
        "production",
      ]);
    });

    it("ignora o separador do pnpm ao escolher as fases", () => {
      expect(journeyPhases(["--", "--grep", "lição 1"])).toEqual([
        "development",
      ]);
    });
  });
});
