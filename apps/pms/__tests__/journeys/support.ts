import { expect, test as base, type Page } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const LOCAL_PASSWORD = "Hotelaria123!";
const DATABASE_CONTAINER = "supabase_db_IFSP_PROJETO";
// O executor do Playwright roda a partir de apps/pms.
const ROOT_DIRECTORY = resolve(process.cwd(), "../..");

type Problem = { kind: string; detail: string };

type Diagnostics = {
  /** Ignora um problema que a própria lição provoca de propósito. */
  allow: (pattern: RegExp) => void;
};

function isOwnTraffic(url: string): boolean {
  return /^http:\/\/(127\.0\.0\.1|localhost):\d+/.test(url);
}

/**
 * Toda jornada falha se o sistema real responder 5xx, lançar erro não tratado ou
 * registrar console.error, mesmo que a tela pareça correta.
 */
export const test = base.extend<{ diagnostics: Diagnostics }>({
  diagnostics: [
    async ({ context }, use, testInfo) => {
      const problems: Problem[] = [];
      const clientErrors: string[] = [];
      const allowed: RegExp[] = [];

      context.on("response", (response) => {
        const url = response.url();
        if (!isOwnTraffic(url)) return;
        const line = `${response.status()} ${response.request().method()} ${url}`;
        if (response.status() >= 500) {
          problems.push({ kind: "http", detail: line });
        } else if (response.status() >= 400) {
          clientErrors.push(line);
        }
      });
      context.on("weberror", (error) => {
        problems.push({ kind: "exception", detail: error.error().message });
      });
      context.on("console", (message) => {
        // O recarregamento automático do next dev não pertence ao sistema.
        if (
          message.type() === "error" &&
          !message.text().includes("webpack-hmr")
        ) {
          problems.push({ kind: "console", detail: message.text() });
        }
      });

      await use({ allow: (pattern) => allowed.push(pattern) });

      const unexpected = problems.filter(
        (problem) => !allowed.some((pattern) => pattern.test(problem.detail)),
      );
      await testInfo.attach("diagnostics.json", {
        body: JSON.stringify({ unexpected, clientErrors }, null, 2),
        contentType: "application/json",
      });
      expect
        .soft(
          unexpected.map(({ kind, detail }) => `${kind}: ${detail}`),
          "Problemas técnicos registrados durante a jornada",
        )
        .toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

function training(args: string[]): void {
  const script = resolve(ROOT_DIRECTORY, "scripts/training.mjs");
  if (!existsSync(script)) throw new Error(`Script ausente: ${script}`);
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT_DIRECTORY,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `training ${args.join(" ")} falhou:\n${result.stdout}\n${result.stderr}`,
    );
  }
}

async function waitForSupabase(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  await expect
    .poll(
      async () => {
        try {
          const response = await fetch(
            `${url}/rest/v1/hotels?select=id&limit=1`,
            { headers: { apikey: key!, authorization: `Bearer ${key}` } },
          );
          return response.status;
        } catch {
          return 0;
        }
      },
      { timeout: 90_000, intervals: [1_000] },
    )
    .toBe(200);
}

/** Destrutivo somente para o Supabase local; training.mjs valida o destino. */
export async function prepareScenario(scenario: string): Promise<void> {
  training(["reset", "--scenario", scenario, "--yes"]);
  await waitForSupabase();
  training(["verify", "--scenario", scenario]);
}

/** Consulta somente leitura ao banco local, para conferir o estado final. */
export function queryLocal(sql: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      DATABASE_CONTAINER,
      "psql",
      "-X",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      "-t",
      "-A",
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      input: `begin read only;\n${sql}\nrollback;\n`,
    },
  ).trim();
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(LOCAL_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
}
