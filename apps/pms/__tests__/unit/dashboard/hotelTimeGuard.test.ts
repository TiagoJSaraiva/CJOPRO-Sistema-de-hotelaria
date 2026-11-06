import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const dashboard = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../src/app/dashboard",
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function offenders(pattern: RegExp): string[] {
  return sourceFiles(dashboard).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return [...source.matchAll(pattern)].map((match) => {
      const line = source.slice(0, match.index).split("\n").length;
      return `${relative(dashboard, file).replaceAll("\\", "/")}:${line}`;
    });
  });
}

// Formatar um instante sem `timeZone` usa o fuso de quem renderiza: mostra a hora errada e,
// com servidor e navegador em fusos diferentes, quebra a hidratação da página. A exceção é
// uma data civil lida ao meio-dia, em que leitura e escrita usam o mesmo fuso.
it("as telas não formatam instantes no fuso de quem renderiza", () => {
  expect(
    offenders(
      /new Date\(\s*(?!`[^`]*T12:00:00`)[^;{}]*?\)\s*\.toLocale(?:Date|Time)?String\(\s*"pt-BR"\s*(?:,\s*\{(?![^}]*timeZone)[^}]*\},?\s*|,\s*)?\)/g,
    ),
  ).toEqual([]);
});

// `new Date("2026-05-13T10:00")`, no navegador, grava a hora no fuso de quem preenche.
it("as telas não leem campos de data e hora no fuso do navegador", () => {
  expect(offenders(/new Date\(\s*String\(/g)).toEqual([]);
});
