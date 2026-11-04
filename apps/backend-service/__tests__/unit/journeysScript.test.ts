import { describe, expect, it } from "vitest";
import {
  buildJourneyEnvironment,
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
});
