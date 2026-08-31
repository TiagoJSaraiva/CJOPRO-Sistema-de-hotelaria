#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIRECTORY = fileURLToPath(new URL("..", import.meta.url));
const ROOT_REPORT_DIRECTORY = path.join(ROOT_DIRECTORY, "coverage");
const SUMMARY_PATH = path.join(ROOT_REPORT_DIRECTORY, "summary.md");
const METRICS = ["statements", "branches", "functions", "lines"];
const WORKSPACES = [
  { name: "Backend", directory: "apps/backend-service" },
  { name: "Booking engine", directory: "apps/booking-engine-service" },
  { name: "PMS", directory: "apps/pms" },
  { name: "Shared", directory: "packages/shared" },
];

function workspaceCoverageDirectory(workspace) {
  return path.join(ROOT_DIRECTORY, workspace.directory, "coverage");
}

function assertGeneratedPath(target) {
  const relativePath = path.relative(ROOT_DIRECTORY, target);
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Caminho de relatório inseguro: ${target}`);
  }
}

function cleanReports() {
  const reportDirectories = [
    ROOT_REPORT_DIRECTORY,
    ...WORKSPACES.map(workspaceCoverageDirectory),
  ];

  for (const reportDirectory of reportDirectories) {
    assertGeneratedPath(reportDirectory);
    rmSync(reportDirectory, { recursive: true, force: true });
  }
}

function runTurboCoverage() {
  const inheritedPnpmEntry = process.env.npm_execpath;
  const args = ["exec", "turbo", "run", "test:coverage"];

  if (inheritedPnpmEntry && existsSync(inheritedPnpmEntry)) {
    return spawnSync(process.execPath, [inheritedPnpmEntry, ...args], {
      cwd: ROOT_DIRECTORY,
      stdio: "inherit",
      windowsHide: true,
    });
  }

  const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return spawnSync(executable, args, {
    cwd: ROOT_DIRECTORY,
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: true,
  });
}

function readMetric(metric, workspaceName, metricName) {
  if (
    typeof metric !== "object" ||
    metric === null ||
    !Number.isInteger(metric.total) ||
    !Number.isInteger(metric.covered) ||
    metric.total < 0 ||
    metric.covered < 0 ||
    metric.covered > metric.total
  ) {
    throw new Error(`${workspaceName}: métrica ${metricName} inválida.`);
  }

  return { total: metric.total, covered: metric.covered };
}

function readWorkspaceSummary(workspace) {
  const summaryPath = path.join(
    workspaceCoverageDirectory(workspace),
    "coverage-summary.json",
  );

  if (!existsSync(summaryPath)) {
    throw new Error(
      `${workspace.name}: ${path.relative(ROOT_DIRECTORY, summaryPath)} ausente.`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(summaryPath, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${workspace.name}: JSON de cobertura inválido (${reason}).`,
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.total !== "object"
  ) {
    throw new Error(`${workspace.name}: resumo não contém o objeto total.`);
  }

  return Object.fromEntries(
    METRICS.map((metricName) => [
      metricName,
      readMetric(parsed.total[metricName], workspace.name, metricName),
    ]),
  );
}

function formatMetric(metric) {
  const percentage =
    metric.total === 0
      ? 100
      : Math.floor((metric.covered * 10_000) / metric.total) / 100;
  return `${percentage.toFixed(2)}% (${metric.covered}/${metric.total})`;
}

function buildReport() {
  const rows = [];
  const errors = [];
  const totals = Object.fromEntries(
    METRICS.map((metricName) => [metricName, { covered: 0, total: 0 }]),
  );

  for (const workspace of WORKSPACES) {
    try {
      const summary = readWorkspaceSummary(workspace);
      for (const metricName of METRICS) {
        totals[metricName].covered += summary[metricName].covered;
        totals[metricName].total += summary[metricName].total;
      }
      rows.push(
        `| ${workspace.name} | ${METRICS.map((metricName) => formatMetric(summary[metricName])).join(" | ")} |`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      rows.push(
        `| ${workspace.name} | indisponível | indisponível | indisponível | indisponível |`,
      );
    }
  }

  rows.push(
    `| **Total ponderado** | ${METRICS.map((metricName) => `**${formatMetric(totals[metricName])}**`).join(" | ")} |`,
  );

  const lines = [
    "# Cobertura Vitest",
    "",
    "| Workspace | Statements | Branches | Functions | Lines |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    "O total é calculado pela soma de itens cobertos e elegíveis, sem média simples entre workspaces.",
  ];

  if (errors.length > 0) {
    lines.push(
      "",
      "## Problemas nos relatórios",
      "",
      ...errors.map((error) => `- ${error}`),
    );
  }

  return { markdown: `${lines.join("\n")}\n`, errors };
}

function publishReport(markdown) {
  mkdirSync(ROOT_REPORT_DIRECTORY, { recursive: true });
  writeFileSync(SUMMARY_PATH, markdown, "utf8");
  process.stdout.write(`\n${markdown}`);

  const githubSummaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (githubSummaryPath) {
    appendFileSync(githubSummaryPath, `\n${markdown}`, "utf8");
  }
}

const reportOnly = process.argv.slice(2).includes("--report-only");
let coverageExitCode = 0;

if (!reportOnly) {
  try {
    cleanReports();
    const result = runTurboCoverage();
    coverageExitCode = result.status ?? 1;
    if (result.error) {
      process.stderr.write(
        `Falha ao iniciar o Turbo: ${result.error.message}\n`,
      );
    }
  } catch (error) {
    coverageExitCode = 1;
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Falha ao preparar a cobertura: ${message}\n`);
  }
}

let reportErrors = [];
try {
  const report = buildReport();
  reportErrors = report.errors;
  publishReport(report.markdown);
} catch (error) {
  reportErrors = [error instanceof Error ? error.message : String(error)];
  process.stderr.write(`Falha ao consolidar cobertura: ${reportErrors[0]}\n`);
}

if (coverageExitCode !== 0) {
  process.stderr.write(
    `A execução de cobertura falhou com código ${coverageExitCode}.\n`,
  );
}
if (reportErrors.length > 0) {
  process.stderr.write(
    "Os relatórios de cobertura estão ausentes ou inválidos.\n",
  );
}

process.exitCode = coverageExitCode === 0 && reportErrors.length === 0 ? 0 : 1;
