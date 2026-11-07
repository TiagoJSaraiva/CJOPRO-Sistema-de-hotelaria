import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../scripts/docs-check.mjs",
);

const OPEN_LEDGER = `# Registro

## Abertos

| ID     | Sev |
| ------ | --- |
| QA-001 | S2  |

## Fechados

| ID     | Sev |
| ------ | --- |
| QA-002 | S2  |
`;

type Overrides = {
  decision?: string;
  decisionName?: string;
  extra?: Record<string, string>;
  index?: string;
  status?: string;
};

function decision(status = "aceita", proof = "- [Prova](../prova.md)"): string {
  return `# 0001: Uma decisão

- **Status:** ${status}
- **Data:** 2026-11-07
- **Origem:** decisão do usuário
- **Áreas:** reservas

## Decisão

Texto.

## Motivo

Texto.

## Alternativas recusadas

Texto.

## Consequências

Texto.

## Prova

${proof}
`;
}

const roots: string[] = [];

/** Só as regras de decisões e status: a cópia mínima não tem o resto da documentação. */
function run(
  overrides: Overrides = {},
): Array<{ id: string; message: string }> {
  const root = mkdtempSync(join(tmpdir(), "docs-check-"));
  roots.push(root);
  const write = (path: string, contents: string) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };
  mkdirSync(join(root, "scripts"));
  copyFileSync(SCRIPT, join(root, "scripts/docs-check.mjs"));
  write("package.json", JSON.stringify({ scripts: {} }));
  write("docs/commands.md", "# Comandos\n");
  write("docs/prova.md", "# Prova\n");
  write("docs/qa/bug-ledger.md", OPEN_LEDGER);
  write("docs/status.md", overrides.status ?? "# Status\n\nAberto: QA-001.\n");
  const name = overrides.decisionName ?? "0001-uma-decisao.md";
  write(`docs/decisions/${name}`, overrides.decision ?? decision());
  write(
    "docs/decisions/README.md",
    overrides.index ?? `# Decisões\n\n- [0001](${name})\n`,
  );
  for (const [path, contents] of Object.entries(overrides.extra ?? {})) {
    write(path, contents);
  }

  const result = spawnSync(
    process.execPath,
    [join(root, "scripts/docs-check.mjs"), "--json"],
    { encoding: "utf8" },
  );
  const report = JSON.parse(result.stdout) as {
    errors: Array<{ id: string; message: string }>;
  };
  return report.errors.filter(({ id }) =>
    ["decisions", "project-status"].includes(id),
  );
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("docs-check: decisões e status do projeto", () => {
  it("aceita decisões e status válidos", () => {
    expect(run()).toEqual([]);
  });

  it("aceita decisão a implementar ainda sem prova", () => {
    expect(
      run({ decision: decision("a implementar", "Pendente: QA-001.") }),
    ).toEqual([]);
  });

  it("aceita decisão substituída por outra existente", () => {
    const replacement = decision().replace("# 0001:", "# 0002:");
    expect(
      run({
        decision: decision("substituída por [0002](0002-outra.md)"),
        extra: { "docs/decisions/0002-outra.md": replacement },
        index:
          "# Decisões\n\n- [0001](0001-uma-decisao.md)\n- [0002](0002-outra.md)\n",
      }),
    ).toEqual([]);
  });

  it("reprova decisão aceita sem link de prova", () => {
    const errors = run({ decision: decision("aceita", "Nenhuma.") });
    expect(errors.map(({ message }) => message).join()).toMatch(/prova/i);
  });

  it("reprova campo obrigatório ausente", () => {
    const errors = run({
      decision: decision().replace("- **Origem:** decisão do usuário\n", ""),
    });
    expect(errors.map(({ message }) => message).join()).toMatch(/Origem/);
  });

  it("reprova seção obrigatória ausente", () => {
    const errors = run({
      decision: decision().replace("## Motivo\n", ""),
    });
    expect(errors.map(({ message }) => message).join()).toMatch(/Motivo/);
  });

  it("reprova status desconhecido", () => {
    const errors = run({ decision: decision("talvez") });
    expect(errors.map(({ message }) => message).join()).toMatch(/status/i);
  });

  it("reprova título com número diferente do arquivo", () => {
    const errors = run({
      decision: decision().replace("# 0001:", "# 0009:"),
    });
    expect(errors.map(({ message }) => message).join()).toMatch(/0001/);
  });

  it("reprova numeração repetida", () => {
    const errors = run({
      extra: { "docs/decisions/0001-outra.md": decision() },
      index:
        "# Decisões\n\n- [0001](0001-uma-decisao.md)\n- [0001](0001-outra.md)\n",
    });
    expect(errors.map(({ message }) => message).join()).toMatch(/repetid/i);
  });

  it("reprova decisão fora do índice", () => {
    const errors = run({ index: "# Decisões\n" });
    expect(errors.map(({ message }) => message).join()).toMatch(/índice/i);
  });

  it("reprova nome de arquivo fora do padrão", () => {
    const errors = run({
      decisionName: "decisao-sem-numero.md",
      index: "# Decisões\n\n- [x](decisao-sem-numero.md)\n",
    });
    expect(errors.map(({ message }) => message).join()).toMatch(/nome/i);
  });

  it("reprova substituta inexistente", () => {
    const errors = run({
      decision: decision("substituída por [0002](0002-ausente.md)"),
    });
    expect(errors.map(({ message }) => message).join()).toMatch(/substitut/i);
  });

  it("reprova status que cita defeito já fechado", () => {
    const errors = run({ status: "# Status\n\nAberto: QA-002.\n" });
    expect(errors.map(({ id }) => id)).toContain("project-status");
    expect(errors.map(({ message }) => message).join()).toMatch(/QA-002/);
  });

  it("reprova status que cita defeito inexistente", () => {
    const errors = run({ status: "# Status\n\nAberto: QA-999.\n" });
    expect(errors.map(({ message }) => message).join()).toMatch(/QA-999/);
  });
});
