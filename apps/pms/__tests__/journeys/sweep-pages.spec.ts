import type { Page } from "@playwright/test";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  expect,
  findInvariantViolations,
  prepareScenario,
  readBackendEvents,
  signIn,
  test,
} from "./support";

// Varredura: abre todas as páginas do PMS com cada conta, no cenário mais completo do
// curso, e registra o que nenhuma lição percorre. Não valida regras de negócio: procura
// tela quebrada, erro engolido, dado cru, link morto e menu que leva a acesso negado.
const ACCOUNTS = [
  "admin@hotelaria.local",
  "gerente.aurora@hotelaria.local",
  "recepcao.aurora@hotelaria.local",
  "governanca.aurora@hotelaria.local",
  "tecnico.aurora@hotelaria.local",
  "supervisor.manutencao.aurora@hotelaria.local",
  "caixa.aurora@hotelaria.local",
  "estoque.compras.aurora@hotelaria.local",
  "financeiro.aurora@hotelaria.local",
  "gerente.horizonte@hotelaria.local",
];

const SETTLE_TIMEOUT_MS = 30_000;
const LOADING_TEXT = /^\s*Carregando/;

const REPORT_PATH = resolve(
  process.cwd(),
  "../../node_modules/.cache/pms-journeys-sweep.json",
);

// Texto que nunca deveria chegar à tela de um usuário.
const RAW_VALUE = /\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date/;
// Erro tratado pela tela: a resposta é 200, então nada mais o denuncia.
const SWALLOWED_ERROR =
  /Falha ao [a-zà-ú]+|Não foi possível|Erro ao [a-zà-ú]+|Internal Server Error/;
// Código interno exibido sem tradução, como confirmed_stay.
const RAW_CODE = /\b[a-z]{3,}_[a-z_]{3,}\b/g;

type Finding = { account: string; url: string; kind: string; detail: string };

function staticRoutes(): string[] {
  const root = resolve(process.cwd(), "src/app/dashboard");
  const walk = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name === "page.tsx" ? [directory] : [];
    });
  return walk(root)
    .map((directory) =>
      `/dashboard${directory.slice(root.length).replaceAll("\\", "/")}`.replace(
        /\/$/,
        "",
      ),
    )
    .filter((route) => !route.includes("["))
    .sort();
}

function routePattern(url: string): string {
  return url
    .split("?")[0]!
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:n");
}

async function navLinks(page: Page): Promise<string[]> {
  return page
    .getByRole("navigation", { name: "Navegação principal do PMS" })
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
    );
}

async function internalLinks(page: Page, retries = 2): Promise<string[]> {
  try {
    return await page
      .locator('main a[href^="/dashboard"]')
      .evaluateAll((links) =>
        links.map((link) => {
          const url = new URL((link as HTMLAnchorElement).href);
          return `${url.pathname}${url.search}`;
        }),
      );
  } catch (error) {
    // O servidor de desenvolvimento pode recarregar a página ao recompilar. Isso não é defeito da tela, e
    // perder a varredura inteira por causa disso esconderia o restante do relatório.
    if (retries === 0 || !/context was destroyed/i.test(String(error)))
      throw error;
    await page.waitForLoadState("load");
    return internalLinks(page, retries - 1);
  }
}

// O redirecionamento e o estado de carregamento trocam o conteúdo depois do evento load.
// Ler antes disso acusaria tela vazia falsa e deixaria a página real sem inspeção.
async function settledText(page: Page): Promise<string> {
  const main = page.locator("main").first();
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let text = "";
  do {
    text = await main.innerText({ timeout: 2_000 }).catch(() => "");
    if (text.trim() && !LOADING_TEXT.test(text)) return text;
    await page.waitForTimeout(250);
  } while (Date.now() < deadline);
  return text;
}

async function inspect(
  page: Page,
  account: string,
  target: string,
  findings: Finding[],
  retriedNavigations: Finding[],
): Promise<string[]> {
  const add = (kind: string, detail: string) =>
    findings.push({ account, url: target, kind, detail });

  let response;
  try {
    response = await page.goto(target, { waitUntil: "load" });
  } catch (firstError) {
    // O next dev reinicia ao se aproximar do limite de memória e derruba a navegação em curso. Uma segunda
    // tentativa separa isso de uma página lenta de verdade, e o relatório guarda a repetição para comparar rodadas.
    retriedNavigations.push({
      account,
      url: target,
      kind: "timeout",
      detail: String(firstError).slice(0, 160),
    });
    try {
      response = await page.goto(target, { waitUntil: "load" });
    } catch (error) {
      add("timeout", String(error).slice(0, 160));
      return [];
    }
  }
  const status = response?.status() ?? 0;
  if (status >= 400)
    add(status === 404 ? "link-morto" : "http", String(status));
  if (status >= 500) return [];

  const finalUrl = new URL(page.url());
  if (finalUrl.pathname.startsWith("/login")) add("sessao", finalUrl.search);

  const text = await settledText(page);
  if (!text.trim()) add("tela-vazia", "conteúdo principal vazio");
  if (LOADING_TEXT.test(text)) add("carregamento-preso", text.slice(0, 80));

  const raw = text.match(RAW_VALUE);
  if (raw) add("valor-cru", raw[0]);
  const swallowed = text.match(SWALLOWED_ERROR);
  if (swallowed) {
    const line = text
      .split("\n")
      .find((candidate) => candidate.includes(swallowed[0]));
    add("erro-na-tela", (line || swallowed[0]).slice(0, 200));
  }
  const codes = [...new Set(text.match(RAW_CODE) || [])];
  // A tela de permissões mostra de propósito os nomes técnicos das permissões.
  if (codes.length && !target.startsWith("/dashboard/permissions")) {
    add("codigo-interno", codes.slice(0, 8).join(", "));
  }

  return internalLinks(page);
}

test.describe("varredura de páginas por conta", () => {
  const findings: Finding[] = [];
  const retriedNavigations: Finding[] = [];
  const visited: Record<string, number> = {};

  test.beforeAll(async () => {
    test.setTimeout(600_000);
    await prepareScenario("integrated-shift");
  });

  test.afterAll(() => {
    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          visited,
          findings,
          retriedNavigations,
          backend: readBackendEvents().filter(
            (event) => event.kind === "contract" || event.status >= 400,
          ),
          invariants: findInvariantViolations(),
        },
        null,
        2,
      ),
    );
  });

  for (const account of ACCOUNTS) {
    test(`varredura: ${account}`, async ({ page, diagnostics }) => {
      test.setTimeout(1_800_000);
      // Esta varredura consolida tudo em um relatório; falhar página a página esconderia
      // o restante. O teste final reprova a rodada com todos os achados das dez contas.
      diagnostics.allow(/./);

      await signIn(page, account);
      const menu = await navLinks(page);
      const seenPatterns = new Set<string>();
      const queue = staticRoutes();
      const crawled: string[] = [];

      while (queue.length) {
        const target = queue.shift()!;
        const pattern = routePattern(target);
        if (seenPatterns.has(pattern)) continue;
        seenPatterns.add(pattern);
        crawled.push(target);

        const links = await inspect(
          page,
          account,
          target,
          findings,
          retriedNavigations,
        );
        const landed = new URL(page.url()).pathname;
        // /dashboard/hotels redirecionar para /dashboard/hotels/view é navegação normal.
        if (menu.includes(target) && !landed.startsWith(target)) {
          findings.push({
            account,
            url: target,
            kind: "menu-sem-acesso",
            detail: `redirecionou para ${landed}`,
          });
        }
        for (const link of links) {
          if (!seenPatterns.has(routePattern(link))) queue.push(link);
        }
      }

      visited[account] = crawled.length;
      expect(crawled.length).toBeGreaterThan(0);
    });
  }

  // Reprovar conta a conta reiniciaria o processo do Playwright, que zera estes acumuladores, reaplica o
  // cenário e grava um relatório só com a última parte.
  test("varredura: relatório sem achados", () => {
    expect(Object.keys(visited).sort(), "contas varridas nesta rodada").toEqual(
      [...ACCOUNTS].sort(),
    );
    expect(findings, "achados da varredura").toEqual([]);
  });
});
