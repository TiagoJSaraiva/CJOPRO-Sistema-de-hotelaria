#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_NODE_VERSION = "22.23.2";
const EXPECTED_PNPM_VERSION = "9.12.3";
const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUTPUT = process.argv.includes("--json");

const EXPECTED_WORKSPACES = [
  ".",
  "apps/backend-service",
  "apps/booking-engine-service",
  "apps/pms",
  "packages/shared",
];

const ESSENTIAL_CLIS = [
  { name: "turbo", directory: ".", packageName: "turbo", binName: "turbo" },
  {
    name: "TypeScript",
    directory: ".",
    packageName: "typescript",
    binName: "tsc",
  },
  { name: "ESLint", directory: ".", packageName: "eslint", binName: "eslint" },
  { name: "Vitest", directory: ".", packageName: "vitest", binName: "vitest" },
  {
    name: "Supabase CLI",
    directory: ".",
    packageName: "supabase",
    binName: "supabase",
  },
  {
    name: "Next.js",
    directory: "apps/pms",
    packageName: "next",
    binName: "next",
  },
  {
    name: "Playwright",
    directory: "apps/pms",
    packageName: "@playwright/test",
    binName: "playwright",
  },
  {
    name: "tsx (backend)",
    directory: "apps/backend-service",
    packageName: "tsx",
    binName: "tsx",
  },
  {
    name: "tsup (backend)",
    directory: "apps/backend-service",
    packageName: "tsup",
    binName: "tsup",
  },
  {
    name: "tsx (booking)",
    directory: "apps/booking-engine-service",
    packageName: "tsx",
    binName: "tsx",
  },
  {
    name: "tsup (booking)",
    directory: "apps/booking-engine-service",
    packageName: "tsup",
    binName: "tsup",
  },
  {
    name: "tsup (shared)",
    directory: "packages/shared",
    packageName: "tsup",
    binName: "tsup",
  },
];

const checks = [];

function addCheck(id, label, ok, { expected, actual, hint } = {}) {
  checks.push({ id, label, ok, expected, actual, hint });
}

function runPnpm(args, directory = ROOT_DIRECTORY) {
  const inheritedPnpmEntry = process.env.npm_execpath;

  if (inheritedPnpmEntry && existsSync(inheritedPnpmEntry)) {
    return spawnSync(process.execPath, [inheritedPnpmEntry, ...args], {
      cwd: directory,
      encoding: "utf8",
      windowsHide: true,
    });
  }

  const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return spawnSync(executable, args, {
    cwd: directory,
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true,
  });
}

function getCommandOutput(result) {
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

function readJson(relativePath) {
  return JSON.parse(
    readFileSync(resolve(ROOT_DIRECTORY, relativePath), "utf8"),
  );
}

function getLockfileImporters(lockfileContents) {
  const importersSection =
    lockfileContents
      .split(/^packages:\s*$/m)[0]
      ?.split(/^importers:\s*$/m)[1] || "";
  return [...importersSection.matchAll(/^  ([^\s][^:\r\n]*):\r?$/gm)].map(
    (match) => match[1],
  );
}

function resolveCliBinary(cli) {
  const packageParts = cli.packageName.split("/");
  const packageJsonPath = resolve(
    ROOT_DIRECTORY,
    cli.directory,
    "node_modules",
    ...packageParts,
    "package.json",
  );
  if (!existsSync(packageJsonPath)) {
    return { ok: false, reason: "package.json ausente" };
  }

  const cliPackageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const binaryPath =
    typeof cliPackageJson.bin === "string"
      ? cliPackageJson.bin
      : cliPackageJson.bin?.[cli.binName];
  if (!binaryPath) {
    return { ok: false, reason: `bin ${cli.binName} não declarado` };
  }

  const resolvedBinaryPath = resolve(dirname(packageJsonPath), binaryPath);
  return existsSync(resolvedBinaryPath)
    ? { ok: true }
    : { ok: false, reason: `bin ausente em ${resolvedBinaryPath}` };
}

addCheck(
  "node-version",
  "Versão do Node.js",
  process.versions.node === EXPECTED_NODE_VERSION,
  {
    expected: EXPECTED_NODE_VERSION,
    actual: process.versions.node,
    hint: `Execute \"nvm install ${EXPECTED_NODE_VERSION}\" e \"nvm use ${EXPECTED_NODE_VERSION}\".`,
  },
);

const pnpmVersionResult = runPnpm(["--version"]);
const pnpmVersion =
  getCommandOutput(pnpmVersionResult).split(/\r?\n/).at(-1) || "indisponível";
addCheck(
  "pnpm-version",
  "Versão do pnpm",
  pnpmVersionResult.status === 0 && pnpmVersion === EXPECTED_PNPM_VERSION,
  {
    expected: EXPECTED_PNPM_VERSION,
    actual: pnpmVersion,
    hint: `Execute \"corepack enable\" e \"corepack prepare pnpm@${EXPECTED_PNPM_VERSION} --activate\".`,
  },
);

const packageJson = readJson("package.json");
const declaredNode = packageJson.engines?.node;
const declaredPnpm = packageJson.engines?.pnpm;
const declaredPackageManager = packageJson.packageManager;
const metadataOk =
  declaredNode === EXPECTED_NODE_VERSION &&
  declaredPnpm === EXPECTED_PNPM_VERSION &&
  declaredPackageManager === `pnpm@${EXPECTED_PNPM_VERSION}`;
addCheck("toolchain-metadata", "Metadados de toolchain", metadataOk, {
  expected: `node=${EXPECTED_NODE_VERSION}; pnpm=${EXPECTED_PNPM_VERSION}`,
  actual: `node=${declaredNode || "ausente"}; pnpm=${declaredPnpm || "ausente"}; packageManager=${declaredPackageManager || "ausente"}`,
  hint: "Alinhe engines e packageManager no package.json.",
});

const nvmVersion = readFileSync(
  resolve(ROOT_DIRECTORY, ".nvmrc"),
  "utf8",
).trim();
addCheck(
  "nvm-version",
  "Pinagem do .nvmrc",
  nvmVersion === EXPECTED_NODE_VERSION,
  {
    expected: EXPECTED_NODE_VERSION,
    actual: nvmVersion,
    hint: `Defina ${EXPECTED_NODE_VERSION} no arquivo .nvmrc.`,
  },
);

const missingWorkspaces = EXPECTED_WORKSPACES.filter(
  (workspace) =>
    workspace !== "." &&
    !existsSync(resolve(ROOT_DIRECTORY, workspace, "package.json")),
);
addCheck(
  "workspace-layout",
  "Diretórios do workspace",
  missingWorkspaces.length === 0,
  {
    expected: EXPECTED_WORKSPACES.join(", "),
    actual:
      missingWorkspaces.length === 0
        ? "todos presentes"
        : `ausentes: ${missingWorkspaces.join(", ")}`,
    hint: "Restaure os package.json ausentes ou atualize pnpm-workspace.yaml.",
  },
);

const lockfilePath = resolve(ROOT_DIRECTORY, "pnpm-lock.yaml");
if (existsSync(lockfilePath)) {
  const lockfileImporters = getLockfileImporters(
    readFileSync(lockfilePath, "utf8"),
  );
  const missingImporters = EXPECTED_WORKSPACES.filter(
    (workspace) => !lockfileImporters.includes(workspace),
  );
  const unexpectedImporters = lockfileImporters.filter(
    (workspace) => !EXPECTED_WORKSPACES.includes(workspace),
  );
  const lockfileOk =
    missingImporters.length === 0 && unexpectedImporters.length === 0;
  const details = [];
  if (missingImporters.length)
    details.push(`ausentes: ${missingImporters.join(", ")}`);
  if (unexpectedImporters.length)
    details.push(`obsoletos: ${unexpectedImporters.join(", ")}`);
  addCheck("lockfile-importers", "Importers do lockfile", lockfileOk, {
    expected: EXPECTED_WORKSPACES.join(", "),
    actual: lockfileOk ? lockfileImporters.join(", ") : details.join("; "),
    hint: 'Execute "pnpm install --lockfile-only" com a toolchain fixada e revise o diff.',
  });
} else {
  addCheck("lockfile-importers", "Importers do lockfile", false, {
    expected: "pnpm-lock.yaml presente",
    actual: "arquivo ausente",
    hint: "Restaure o lockfile versionado.",
  });
}

const modulesManifest = resolve(
  ROOT_DIRECTORY,
  "node_modules",
  ".modules.yaml",
);
const dependenciesInstalled = existsSync(modulesManifest);
addCheck(
  "dependencies-installed",
  "Instalação das dependências",
  dependenciesInstalled,
  {
    expected: "node_modules consistente",
    actual: dependenciesInstalled
      ? "manifesto do pnpm presente"
      : "node_modules ausente ou incompleto",
    hint: 'Execute "pnpm install --frozen-lockfile".',
  },
);

if (dependenciesInstalled) {
  const unavailableClis = [];
  for (const cli of ESSENTIAL_CLIS) {
    const resolution = resolveCliBinary(cli);
    if (!resolution.ok) {
      unavailableClis.push(`${cli.name} (${resolution.reason})`);
    }
  }
  addCheck("essential-clis", "CLIs essenciais", unavailableClis.length === 0, {
    expected: ESSENTIAL_CLIS.map((cli) => cli.name).join(", "),
    actual:
      unavailableClis.length === 0
        ? "todos resolvidos"
        : `indisponíveis: ${unavailableClis.join(", ")}`,
    hint: 'Execute "pnpm install --frozen-lockfile"; se o problema persistir, reinstale com "--force".',
  });
} else {
  addCheck("essential-clis", "CLIs essenciais", false, {
    expected: ESSENTIAL_CLIS.map((cli) => cli.name).join(", "),
    actual: "não verificados porque as dependências não estão instaladas",
    hint: 'Execute "pnpm install --frozen-lockfile" e repita o diagnóstico.',
  });
}

const failedChecks = checks.filter((check) => !check.ok);
const report = {
  ok: failedChecks.length === 0,
  expected: {
    node: EXPECTED_NODE_VERSION,
    pnpm: EXPECTED_PNPM_VERSION,
  },
  checks,
};

if (JSON_OUTPUT) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write("Diagnóstico do ambiente\n\n");
  for (const check of checks) {
    process.stdout.write(
      `${check.ok ? "[OK]" : "[FALHA]"} ${check.label}: ${check.actual || "sem detalhes"}\n`,
    );
    if (!check.ok) {
      process.stdout.write(`  Esperado: ${check.expected}\n`);
      process.stdout.write(`  Correção: ${check.hint}\n`);
    }
  }
  process.stdout.write(
    `\nResultado: ${checks.length - failedChecks.length}/${checks.length} verificações aprovadas.\n`,
  );
}

process.exitCode = report.ok ? 0 : 1;
