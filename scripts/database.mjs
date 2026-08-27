#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_API_PORT = "54321";
const TEST_EXCLUDES = [
  "gotrue",
  "realtime",
  "storage-api",
  "imgproxy",
  "mailpit",
  "postgres-meta",
  "studio",
  "edge-runtime",
  "logflare",
  "vector",
  "supavisor"
].join(",");

function run(executable, args, options = {}) {
  return spawnSync(executable, args, {
    cwd: ROOT_DIRECTORY,
    encoding: "utf8",
    shell: options.shell ?? process.platform === "win32",
    windowsHide: true,
    stdio: options.capture ? "pipe" : "inherit",
    env: options.env || process.env
  });
}

function runPnpm(args, options = {}) {
  const inheritedPnpmEntry = process.env.npm_execpath;
  if (inheritedPnpmEntry && existsSync(inheritedPnpmEntry)) {
    return spawnSync(process.execPath, [inheritedPnpmEntry, ...args], {
      cwd: ROOT_DIRECTORY,
      encoding: "utf8",
      windowsHide: true,
      stdio: options.capture ? "pipe" : "inherit",
      env: options.env || process.env
    });
  }

  return run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", args, options);
}

function runSupabase(args, options = {}) {
  return runPnpm(["exec", "supabase", ...args], options);
}

function fail(message, correction) {
  const suffix = correction ? `\nCorrecao: ${correction}` : "";
  throw new Error(`${message}${suffix}`);
}

function validatePrerequisites() {
  const docker = run("docker", ["info", "--format", "{{.ServerVersion}}"], { capture: true });
  if (docker.status !== 0) {
    fail("Docker nao esta disponivel ou o engine nao esta em execucao.", "Abra o Docker Desktop e aguarde o engine iniciar.");
  }

  const supabase = runSupabase(["--version"], { capture: true });
  if (supabase.status !== 0) {
    fail("Supabase CLI nao esta disponivel no workspace.", "Execute pnpm install --frozen-lockfile.");
  }
}

function readLocalStatus() {
  const result = runSupabase(["status", "-o", "json"], { capture: true });
  if (result.status !== 0) {
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    fail("O Supabase CLI retornou um status local invalido.", "Execute pnpm db:stop e pnpm db:start.");
  }
}

export function assertLocalApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("A API_URL do Supabase local e invalida.", "Reinicie o ambiente com pnpm db:stop e pnpm db:start.");
  }

  const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!localHost || url.port !== LOCAL_API_PORT || url.protocol !== "http:") {
    fail(
      `Recusado ambiente Supabase nao local: ${url.origin}`,
      `Use exclusivamente http://127.0.0.1:${LOCAL_API_PORT} ou http://localhost:${LOCAL_API_PORT}.`
    );
  }

  return url.origin;
}

function readLocalKongSecretKey() {
  const config = run(
    "docker",
    ["exec", "supabase_kong_IFSP_PROJETO", "cat", "/home/kong/kong.yml"],
    { capture: true, shell: false }
  );
  if (config.status !== 0) {
    return "";
  }

  return config.stdout.match(/headers[.]apikey == '(sb_secret_[^']+)'/)?.[1] || "";
}

function getLocalCredentials({ allowDerivedKey = false } = {}) {
  const status = readLocalStatus();
  if (!status) {
    fail("Supabase local nao esta em execucao.", "Execute pnpm db:start.");
  }

  const apiUrl = assertLocalApiUrl(String(status.API_URL || ""));
  let serviceRoleKey = String(status.SERVICE_ROLE_KEY || "");
  if (!serviceRoleKey && allowDerivedKey) {
    serviceRoleKey = readLocalKongSecretKey();
  }

  if (!serviceRoleKey) {
    fail("SERVICE_ROLE_KEY local nao foi retornada pelo Supabase CLI.", "Execute pnpm db:stop e pnpm db:start.");
  }

  return { apiUrl, serviceRoleKey };
}

function startLocal({ minimal = false } = {}) {
  validatePrerequisites();
  if (readLocalStatus()) {
    process.stdout.write("Supabase local ja esta em execucao; a instancia existente foi preservada.\n");
    return false;
  }

  const startArgs = minimal ? ["start", "--exclude", TEST_EXCLUDES] : ["start"];
  const result = runSupabase(startArgs, { capture: true });
  if (result.status !== 0) {
    runSupabase(["stop"], { capture: true });
    fail("Nao foi possivel iniciar o Supabase local.", "Confira as portas 54321 e 54322 e execute pnpm db:start novamente.");
  }

  const status = readLocalStatus();
  assertLocalApiUrl(String(status?.API_URL || ""));
  process.stdout.write(
    minimal
      ? "Supabase local de testes iniciado (PostgreSQL, PostgREST e Kong).\n"
      : "Supabase local de desenvolvimento iniciado.\n"
  );
  return true;
}

function stopLocal() {
  const result = runSupabase(["stop"], { capture: true });
  if (result.status !== 0) {
    fail("Nao foi possivel interromper o Supabase local.", "Execute pnpm exec supabase status para diagnosticar os containers.");
  }
  process.stdout.write("Supabase local interrompido; os dados locais foram preservados.\n");
}

function resetLocal() {
  validatePrerequisites();
  const status = readLocalStatus();
  assertLocalApiUrl(String(status?.API_URL || ""));
  const result = runSupabase(["db", "reset", "--local"]);
  if (result.status !== 0) {
    fail("Falha ao recriar o banco local pelas migrations e pelo seed.", "Revise a migration ou seed indicado no erro acima.");
  }
}

function showStatus() {
  validatePrerequisites();
  const status = readLocalStatus();
  const apiUrl = assertLocalApiUrl(String(status?.API_URL || ""));
  process.stdout.write(`Supabase local ativo em ${apiUrl}. Credenciais ocultadas.\n`);
}

function runDatabaseTests() {
  validatePrerequisites();
  const wasRunning = Boolean(readLocalStatus());
  let startedHere = false;

  try {
    if (!wasRunning) {
      startedHere = startLocal({ minimal: true });
    } else {
      process.stdout.write("Usando a instancia Supabase local que ja estava ativa.\n");
    }

    resetLocal();
    const { apiUrl, serviceRoleKey } = getLocalCredentials({ allowDerivedKey: true });
    const testEnv = {
      ...process.env,
      SUPABASE_URL: apiUrl,
      SUPABASE_SECRET_KEY: serviceRoleKey,
      AUTH_SESSION_SECRET: "database-integration-local-session-secret-only"
    };

    const pgTap = runSupabase(["test", "db", "--local", "supabase/tests/database"], { env: testEnv });
    if (pgTap.status !== 0) {
      fail("Os testes pgTAP falharam.", "Corrija o schema ou seed local e execute pnpm test:db novamente.");
    }

    const vitest = runPnpm(
      ["--filter", "@hotel/backend-service", "exec", "vitest", "run", "--config", "vitest.database.config.ts"],
      { env: testEnv }
    );
    if (vitest.status !== 0) {
      fail("Os testes HTTP com banco real falharam.", "Revise o erro Vitest acima e execute pnpm test:db novamente.");
    }
  } finally {
    if (startedHere) {
      stopLocal();
    }
  }
}

function main() {
  const [command, argument] = process.argv.slice(2);

  switch (command) {
    case "start":
      startLocal();
      break;
    case "status":
      showStatus();
      break;
    case "reset":
      resetLocal();
      break;
    case "stop":
      stopLocal();
      break;
    case "test":
      runDatabaseTests();
      break;
    case "validate-url":
      assertLocalApiUrl(String(argument || ""));
      process.stdout.write("URL local valida.\n");
      break;
    default:
      fail("Comando de banco desconhecido.", "Use start, status, reset, stop ou test.");
  }
}

const invokedFile = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedFile === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
