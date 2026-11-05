import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// QA-005: botões apareciam como texto em 38 arquivos porque usavam classes que nunca
// foram definidas, e os snapshots aprovados congelaram o defeito.
const SRC = resolve(__dirname, "../../src");
const GLOBALS = readFileSync(join(SRC, "app/globals.css"), "utf8");

// Nomes com o prefixo que não são classes do Tailwind.
const NOT_CSS_CLASSES = new Set([
  "pms-main-content", // id do conteúdo principal
  "pms-fade-in", // @keyframes
  "pms-spin", // @keyframes
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

function usedClasses(): Set<string> {
  const used = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    for (const [name] of readFileSync(file, "utf8").matchAll(
      /\bpms-[a-z][a-z-]*[a-z]\b/g,
    )) {
      if (!NOT_CSS_CLASSES.has(name)) used.add(name);
    }
  }
  return used;
}

describe("classes pms-* do PMS", () => {
  it("encontra as classes usadas nas telas", () => {
    expect(usedClasses()).toContain("pms-button-primary");
  });

  it("toda classe usada tem estilo definido em globals.css", () => {
    const undefinedClasses = [...usedClasses()]
      .filter((name) => !new RegExp(`\\.${name}\\b`).test(GLOBALS))
      .sort();

    expect(undefinedClasses).toEqual([]);
  });
});
