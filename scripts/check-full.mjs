#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const PHASES = [
  { name: "check", script: "check" },
  { name: "testes Vitest", script: "test" },
  { name: "testes E2E", script: "test:e2e" }
];

function runPnpmScript(script) {
  const inheritedPnpmEntry = process.env.npm_execpath;

  if (inheritedPnpmEntry && existsSync(inheritedPnpmEntry)) {
    return spawnSync(process.execPath, [inheritedPnpmEntry, "run", script], {
      stdio: "inherit",
      windowsHide: true
    });
  }

  const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  return spawnSync(executable, ["run", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: true
  });
}

const failures = [];

for (const phase of PHASES) {
  process.stdout.write(`\n=== ${phase.name} ===\n`);
  const result = runPnpmScript(phase.script);
  if (result.status !== 0) {
    failures.push({ name: phase.name, exitCode: result.status ?? 1 });
  }
}

if (failures.length === 0) {
  process.stdout.write("\ncheck:full concluído sem falhas.\n");
  process.exitCode = 0;
} else {
  process.stderr.write("\ncheck:full encontrou falhas:\n");
  for (const failure of failures) {
    process.stderr.write(`- ${failure.name} (exit code ${failure.exitCode})\n`);
  }
  process.exitCode = 1;
}
