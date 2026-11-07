import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  baselineChecksums,
  createBaseline,
  hasUsableBaseline,
  resetScenario,
  restoreBaseline,
} from "../../../../scripts/training.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

function realReset(): void {
  const result = spawnSync(
    process.execPath,
    [resolve(ROOT, "scripts/database.mjs"), "reset"],
    { cwd: ROOT, encoding: "utf8", windowsHide: true },
  );
  expect(result.status, result.stderr).toBe(0);
}

// A restauração rápida substitui o reset real nas jornadas. Ela só vale se devolver o banco
// exatamente ao estado logo depois do reset: é o que sustenta "a partir do reset" nas rodadas.
describe("restauração rápida do banco de treinamento", () => {
  let afterRealReset: Record<string, string>;

  beforeAll(() => {
    realReset();
    createBaseline();
    afterRealReset = baselineChecksums();
  }, 300_000);

  it("devolve cada tabela e sequência ao estado do reset real", async () => {
    await resetScenario("cash-close", true, { fast: true });
    const scenario = baselineChecksums();
    expect(
      Object.keys(scenario).filter(
        (table) => scenario[table] !== afterRealReset[table],
      ).length,
      "o cenário precisa mudar dados, senão a comparação não prova nada",
    ).toBeGreaterThan(0);

    restoreBaseline();

    expect(baselineChecksums()).toEqual(afterRealReset);
  }, 120_000);

  it("deixa de valer depois de um reset real, e o reset rápido a recria", async () => {
    expect(hasUsableBaseline()).toBe(true);
    realReset();
    expect(hasUsableBaseline()).toBe(false);
    await resetScenario("orientation", true, { fast: true });
    expect(hasUsableBaseline()).toBe(true);
  }, 300_000);
});
