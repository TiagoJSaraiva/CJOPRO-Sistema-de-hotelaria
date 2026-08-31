import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const BACKEND_DIR = path.join(ROOT_DIR, "apps", "backend-service");
const PMS_PORT = 3001;
const BACKEND_PORT = 3334;
const READINESS_TIMEOUT_MS = readPositiveInteger(
  process.env.HOTEL_DEV_READINESS_TIMEOUT_MS,
  90_000,
  "HOTEL_DEV_READINESS_TIMEOUT_MS",
);
const SHUTDOWN_GRACE_MS = 3_000;
const EXPECTED_SUPABASE_KEY_PLACEHOLDER =
  "obtenha-com-pnpm-exec-supabase-status";

let servicesProcess;
let servicesExited;
let activeProcess;
let activeProcessExited;
let shutdownPromise;
let shutdownRequested = false;

function readPositiveInteger(value, fallback, name) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }

  return parsed;
}

function readEnvFile(filename) {
  const envPath = path.join(BACKEND_DIR, filename);
  if (!existsSync(envPath)) {
    return {};
  }

  try {
    return parseEnv(readFileSync(envPath, "utf8"));
  } catch {
    throw new Error(
      `Não foi possível interpretar apps/backend-service/${filename}. ` +
        "Corrija a sintaxe do arquivo; o conteúdo não foi exibido para proteger secrets.",
    );
  }
}

function validateBackendEnvironment() {
  const configured = {
    ...readEnvFile(".env"),
    ...process.env,
    ...readEnvFile(".env.local"),
  };
  const errors = [];

  if (!configured.SUPABASE_URL) {
    errors.push("SUPABASE_URL está ausente");
  } else {
    try {
      const url = new URL(configured.SUPABASE_URL);
      if (!new Set(["http:", "https:"]).has(url.protocol)) {
        errors.push("SUPABASE_URL deve usar http ou https");
      }
    } catch {
      errors.push("SUPABASE_URL não é uma URL válida");
    }
  }

  const supabaseKey =
    configured.SUPABASE_SECRET_KEY ?? configured.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey || supabaseKey === EXPECTED_SUPABASE_KEY_PLACEHOLDER) {
    errors.push(
      "SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) está ausente",
    );
  }

  if (!configured.AUTH_SESSION_SECRET) {
    errors.push("AUTH_SESSION_SECRET está ausente");
  } else if (configured.AUTH_SESSION_SECRET.length < 32) {
    errors.push("AUTH_SESSION_SECRET deve ter pelo menos 32 caracteres");
  }

  if (configured.PORT === undefined) {
    errors.push("PORT está ausente e deve ser 3334");
  } else if (configured.PORT !== String(BACKEND_PORT)) {
    errors.push("PORT deve ser exatamente 3334");
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuração inválida do backend:\n- ${errors.join("\n- ")}\n` +
        "Correção: copie apps/backend-service/.env.example para .env.local e " +
        "preencha somente credenciais adequadas ao ambiente. Nenhum valor foi exibido.",
    );
  }
}

function checkAddress(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (
        host === "::1" &&
        new Set(["EAFNOSUPPORT", "EADDRNOTAVAIL"]).has(error.code)
      ) {
        resolve();
        return;
      }

      reject(error);
    });
    server.listen(
      { host, port, exclusive: true, ipv6Only: host === "::1" },
      () => {
        server.close((error) => (error ? reject(error) : resolve()));
      },
    );
  });
}

async function validatePorts() {
  for (const { port, service } of [
    { port: PMS_PORT, service: "PMS" },
    { port: BACKEND_PORT, service: "backend" },
  ]) {
    for (const host of ["127.0.0.1", "::1"]) {
      try {
        await checkAddress(port, host);
      } catch (error) {
        if (error.code === "EADDRINUSE") {
          throw new Error(
            `A porta ${port} (${service}) já está ocupada em ${host}. ` +
              "Encerre o processo que a utiliza e execute pnpm dev:pms-backend novamente.",
          );
        }

        throw new Error(
          `Não foi possível validar a porta ${port} (${service}) em ${host}: ${error.message}`,
        );
      }
    }
  }
}

function getPnpmCommand(args) {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...args],
    };
  }

  return {
    command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    args,
  };
}

function spawnPnpm(args, options = {}) {
  const invocation = getPnpmCommand(args);
  return spawn(invocation.command, invocation.args, {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function buildShared() {
  console.log("Preparando @hotel/shared...");
  activeProcess = spawnPnpm(["--filter", "@hotel/shared", "run", "build"], {
    detached: process.platform !== "win32",
  });
  activeProcessExited = waitForExit(activeProcess);
  const result = await activeProcessExited;
  activeProcess = undefined;
  activeProcessExited = undefined;

  if (shutdownRequested) {
    return false;
  }

  if (result.code !== 0) {
    throw new Error(
      "A compilação inicial de @hotel/shared falhou. Corrija os erros acima antes de iniciar os serviços.",
    );
  }

  return true;
}

async function probe(url, deadline) {
  let lastError = "sem resposta";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
      if (response.status === 200) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`Timeout aguardando ${url} (${lastError}).`);
}

function startServices() {
  console.log("Iniciando PMS e backend...");
  servicesProcess = spawnPnpm(
    [
      "--parallel",
      "--filter",
      "@hotel/pms",
      "--filter",
      "@hotel/backend-service",
      "run",
      "dev",
    ],
    { detached: process.platform !== "win32" },
  );
  servicesExited = waitForExit(servicesProcess);
  return servicesProcess;
}

async function waitForServices() {
  const deadline = Date.now() + READINESS_TIMEOUT_MS;
  const readiness = Promise.all([
    probe(`http://127.0.0.1:${PMS_PORT}/login`, deadline),
    probe(`http://127.0.0.1:${BACKEND_PORT}/health`, deadline),
  ]).then(() => ({ ready: true }));
  const exited = servicesExited.then((result) => ({ ready: false, result }));
  const outcome = await Promise.race([readiness, exited]);

  if (!outcome.ready) {
    const detail = outcome.result.signal
      ? `sinal ${outcome.result.signal}`
      : `código ${outcome.result.code ?? "desconhecido"}`;
    throw new Error(
      `O processo de desenvolvimento encerrou antes do readiness (${detail}).`,
    );
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isProcessGroupAlive(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function terminateServices() {
  const child = servicesProcess ?? activeProcess;
  const exited = servicesExited ?? activeProcessExited;
  if (!child?.pid) {
    return;
  }

  if (process.platform === "win32") {
    if (!isProcessAlive(child.pid)) {
      return;
    }
    const result = spawnSync(
      "taskkill",
      ["/PID", String(child.pid), "/T", "/F"],
      {
        stdio: "ignore",
        windowsHide: true,
      },
    );
    if (result.status !== 0 && isProcessAlive(child.pid)) {
      throw new Error(
        `taskkill não conseguiu encerrar a árvore do PID ${child.pid}.`,
      );
    }
    await exited?.catch(() => undefined);
    return;
  }

  if (!isProcessGroupAlive(child.pid)) {
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
    return;
  }

  await Promise.race([
    exited?.catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, SHUTDOWN_GRACE_MS)),
  ]);

  if (isProcessGroupAlive(child.pid)) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") {
        throw error;
      }
    }
    await exited?.catch(() => undefined);
  }
}

function shutdown() {
  if (!shutdownPromise) {
    shutdownPromise = terminateServices();
  }
  return shutdownPromise;
}

async function handleSignal(signal) {
  shutdownRequested = true;
  console.log(`\n${signal} recebido. Encerrando PMS e backend...`);
  try {
    await shutdown();
    console.log("PMS e backend encerrados; portas 3001 e 3334 liberadas.");
    process.exit(0);
  } catch (error) {
    console.error(`Falha ao encerrar os serviços: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  validateBackendEnvironment();
  await validatePorts();
  if (!(await buildShared())) {
    await shutdownPromise;
    return;
  }
  startServices();
  await waitForServices();

  console.log("\nPMS e backend estão prontos:");
  console.log(`- PMS: http://localhost:${PMS_PORT}/login`);
  console.log(`- Backend: http://localhost:${BACKEND_PORT}/health`);
  console.log("Pressione Ctrl+C uma vez para encerrar os dois serviços.");

  const result = await servicesExited;
  if (!shutdownRequested) {
    const detail = result.signal
      ? `sinal ${result.signal}`
      : `código ${result.code ?? "desconhecido"}`;
    throw new Error(
      `O processo de desenvolvimento encerrou inesperadamente (${detail}).`,
    );
  }
}

process.once("SIGINT", () => void handleSignal("SIGINT"));
process.once("SIGTERM", () => void handleSignal("SIGTERM"));

try {
  await main();
} catch (error) {
  try {
    await shutdown();
  } catch (shutdownError) {
    console.error(
      `Falha adicional durante a limpeza: ${shutdownError.message}`,
    );
  }
  if (!shutdownRequested) {
    console.error(`\nErro: ${error.message}`);
    process.exitCode = 1;
  }
}
