#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCENARIO_DIRECTORY = resolve(
  ROOT_DIRECTORY,
  "supabase/training/scenarios",
);
const VERIFICATION_DIRECTORY = resolve(
  ROOT_DIRECTORY,
  "supabase/training/verification",
);
const PROJECT_ID = "IFSP_PROJETO";
const DATABASE_CONTAINER = `supabase_db_${PROJECT_ID}`;
const AURORA_ID = "10000000-0000-4000-8000-000000000001";
const MANAGER_ID = "80000000-0000-4000-8000-000000000002";
const LOCAL_API_PORT = "54321";

export const TRAINING_SCENARIOS = Object.freeze([
  ["orientation", "Orientação, papéis, permissões e pendências"],
  ["reservations-arrival", "Reservas, garantia e chegada"],
  ["channels", "Site direto e canais de reserva"],
  ["governance-maintenance", "Governança e manutenção do quarto 103"],
  ["warranty", "Equipamentos e decisão de garantia"],
  ["consumption-account", "Consumos, pagadores e conta da estadia"],
  ["inventory-procurement", "Estoque, lotes, compras e recebimento"],
  ["cash-close", "Sessão de caixa e fechamento diário"],
  ["partner-settlement", "Parceiros, apuração e contestação"],
  ["integrated-shift", "Turno integrado final"],
]);

const SCENARIO_DEPENDENCIES = Object.freeze({
  "integrated-shift": [
    "reservations-arrival",
    "governance-maintenance",
    "warranty",
    "consumption-account",
    "inventory-procurement",
    "cash-close",
    "partner-settlement",
  ],
});

function fail(message, correction) {
  throw new Error(`${message}${correction ? `\nCorreção: ${correction}` : ""}`);
}

function run(executable, args, options = {}) {
  return spawnSync(executable, args, {
    cwd: ROOT_DIRECTORY,
    encoding: "utf8",
    shell: options.shell ?? process.platform === "win32",
    windowsHide: true,
    stdio: options.input
      ? [
          "pipe",
          options.capture ? "pipe" : "inherit",
          options.capture ? "pipe" : "inherit",
        ]
      : options.capture
        ? "pipe"
        : "inherit",
    input: options.input,
  });
}

function runPnpm(args, options = {}) {
  const entry = process.env.npm_execpath;
  if (entry && existsSync(entry)) {
    return spawnSync(process.execPath, [entry, ...args], {
      cwd: ROOT_DIRECTORY,
      encoding: "utf8",
      windowsHide: true,
      stdio: options.capture ? "pipe" : "inherit",
    });
  }
  return run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, options);
}

export function assertTrainingLocalApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("A URL do Supabase local é inválida.", "Execute pnpm db:start.");
  }
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== LOCAL_API_PORT
  ) {
    fail(
      `Destino recusado por não ser o Supabase local: ${url.origin}`,
      "Use exclusivamente localhost:54321 ou 127.0.0.1:54321.",
    );
  }
  return url.origin;
}

function validateLocalEnvironment() {
  const docker = run("docker", ["info", "--format", "{{.ServerVersion}}"], {
    capture: true,
  });
  if (docker.status !== 0) {
    fail(
      "Docker não está disponível ou o engine não está em execução.",
      "Abra o Docker Desktop e aguarde a inicialização.",
    );
  }
  const status = runPnpm(["exec", "supabase", "status", "-o", "json"], {
    capture: true,
  });
  if (status.status !== 0) {
    fail("Supabase local não está em execução.", "Execute pnpm db:start.");
  }
  let parsed;
  try {
    parsed = JSON.parse(status.stdout);
  } catch {
    fail(
      "O Supabase CLI retornou um status inválido.",
      "Execute pnpm db:stop e pnpm db:start.",
    );
  }
  assertTrainingLocalApiUrl(String(parsed.API_URL || ""));
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runSql(sql, { capture = false } = {}) {
  const result = run(
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
    { capture, input: sql, shell: false },
  );
  if (result.status !== 0) {
    fail(
      "Falha ao executar uma operação no banco local de treinamento.",
      "Revise a migration ou fixture indicada pelo PostgreSQL.",
    );
  }
  return String(result.stdout || "").trim();
}

function environmentSql() {
  return `select public.get_training_environment('${AURORA_ID}'::uuid);`;
}

function knownScenario(key) {
  return TRAINING_SCENARIOS.find(([candidate]) => candidate === key);
}

function scenarioFile(directory, key) {
  if (!knownScenario(key)) {
    fail(
      `Cenário desconhecido: ${key || "(ausente)"}.`,
      "Execute pnpm training scenarios.",
    );
  }
  const file = resolve(directory, `${key}.sql`);
  if (!file.startsWith(`${directory}\\`) && !file.startsWith(`${directory}/`))
    fail("Caminho de cenário recusado.");
  if (!existsSync(file)) fail(`Contrato SQL ausente para o cenário ${key}.`);
  return file;
}

function showClock() {
  validateLocalEnvironment();
  process.stdout.write(`${runSql(environmentSql(), { capture: true })}\n`);
}

function clockAction(action, extra = {}) {
  validateLocalEnvironment();
  const current = JSON.parse(runSql(environmentSql(), { capture: true }));
  const input = {
    action,
    expected_version: current.version,
    reason: "Ajuste local pelo comando pnpm training.",
    ...extra,
  };
  const sql = `select public.act_training_clock(${sqlLiteral(AURORA_ID)}::uuid,${sqlLiteral(MANAGER_ID)}::uuid,${sqlLiteral(JSON.stringify(input))}::jsonb);`;
  process.stdout.write(`${runSql(sql, { capture: true })}\n`);
}

async function confirmReset() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail(
      "A confirmação interativa exige um terminal.",
      "Revise o destino local e use --yes em automações.",
    );
  }
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await prompt.question(
      "Isto apagará e recriará somente os dados do Supabase local. Digite RESETAR para continuar: ",
    );
    return answer.trim() === "RESETAR";
  } finally {
    prompt.close();
  }
}

async function resetScenario(key, yes) {
  const fixture = scenarioFile(SCENARIO_DIRECTORY, key);
  validateLocalEnvironment();
  if (!yes && !(await confirmReset())) {
    process.stdout.write("Reset cancelado; nenhum dado foi alterado.\n");
    return;
  }
  process.stdout.write(`Recriando o Supabase local para o cenário ${key}...\n`);
  const reset = runPnpm(["db:reset"]);
  if (reset.status !== 0) fail("O reset do Supabase local falhou.");
  validateLocalEnvironment();
  for (const dependency of SCENARIO_DEPENDENCIES[key] || []) {
    runSql(readFileSync(scenarioFile(SCENARIO_DIRECTORY, dependency), "utf8"));
  }
  runSql(readFileSync(fixture, "utf8"));
  process.stdout.write(
    `Cenário ${key} preparado e relógio do Hotel Aurora congelado.\n`,
  );
}

function verifyScenario(key) {
  const verification = scenarioFile(VERIFICATION_DIRECTORY, key);
  const common = resolve(VERIFICATION_DIRECTORY, "common.sql");
  if (!existsSync(common)) fail("Contrato comum de verificação ausente.");
  validateLocalEnvironment();
  const environment = JSON.parse(runSql(environmentSql(), { capture: true }));
  if (environment.scenario_key !== key || environment.clock_mode !== "frozen") {
    fail(
      `O banco local está no cenário ${environment.scenario_key || "nenhum"} e relógio ${environment.clock_mode}.`,
      `Execute pnpm training reset --scenario ${key}.`,
    );
  }
  runSql(
    `${readFileSync(common, "utf8")}\n${readFileSync(verification, "utf8")}`,
  );
  process.stdout.write(`Cenário ${key} verificado com sucesso.\n`);
}

async function verifyAllScenarios() {
  validateLocalEnvironment();
  process.stdout.write(
    "A verificação completa recriará somente o Supabase local para cada cenário.\n",
  );
  for (const [key] of TRAINING_SCENARIOS) {
    await resetScenario(key, true);
    verifyScenario(key);
  }
  process.stdout.write("Todos os cenários didáticos foram verificados.\n");
}

export function parseTrainingArguments(argv) {
  const [command, subject, ...rest] = argv;
  if (command === "scenarios") return { kind: "scenarios" };
  if (command === "reset") {
    const scenarioIndex = argv.indexOf("--scenario");
    return {
      kind: "reset",
      scenario: scenarioIndex >= 0 ? argv[scenarioIndex + 1] : undefined,
      yes: argv.includes("--yes"),
    };
  }
  if (command === "verify") {
    const scenarioIndex = argv.indexOf("--scenario");
    return {
      kind: "verify",
      scenario: scenarioIndex >= 0 ? argv[scenarioIndex + 1] : undefined,
      all: argv.includes("--all"),
    };
  }
  if (command === "clock" && subject === "show")
    return { kind: "clock", action: "show" };
  if (command === "clock" && ["freeze", "resume"].includes(subject))
    return { kind: "clock", action: subject };
  if (command === "clock" && subject === "set")
    return { kind: "clock", action: "set", at: rest[0] };
  if (command === "clock" && subject === "advance") {
    return {
      kind: "clock",
      action: "advance",
      amount: Number(rest[0]),
      unit: rest[1],
    };
  }
  return { kind: "help" };
}

async function main(argv) {
  const parsed = parseTrainingArguments(argv);
  if (parsed.kind === "scenarios") {
    for (const [key, description] of TRAINING_SCENARIOS)
      process.stdout.write(`${key}\t${description}\n`);
    return;
  }
  if (parsed.kind === "reset")
    return resetScenario(parsed.scenario, parsed.yes);
  if (parsed.kind === "verify") {
    if (parsed.all && parsed.scenario)
      fail("Use --all ou --scenario, nunca os dois ao mesmo tempo.");
    if (parsed.all) return verifyAllScenarios();
    if (!parsed.scenario)
      fail(
        "Informe --scenario <cenário> ou --all para verificar o treinamento.",
      );
    return verifyScenario(parsed.scenario);
  }
  if (parsed.kind === "clock") {
    if (parsed.action === "show") return showClock();
    if (parsed.action === "set") {
      if (!parsed.at || Number.isNaN(Date.parse(parsed.at)))
        fail("Informe uma data-hora ISO válida para clock set.");
      return clockAction("set", { at: new Date(parsed.at).toISOString() });
    }
    if (parsed.action === "advance") {
      if (
        !Number.isInteger(parsed.amount) ||
        parsed.amount <= 0 ||
        !["hours", "days"].includes(parsed.unit)
      ) {
        fail(
          "Use clock advance com quantidade positiva e unidade hours ou days.",
        );
      }
      return clockAction("advance", {
        amount: parsed.amount,
        unit: parsed.unit,
      });
    }
    return clockAction(parsed.action);
  }
  process.stdout.write(
    "Uso:\n  pnpm training reset --scenario <cenário> [--yes]\n  pnpm training verify --scenario <cenário>\n  pnpm training verify --all\n  pnpm training clock show|freeze|resume\n  pnpm training clock set <data-hora ISO>\n  pnpm training clock advance <quantidade> <hours|days>\n  pnpm training scenarios\n",
  );
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
