import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = resolve(__dirname, "../../src");
const UNACCENTED =
  /\b(nao|invalido|invalida|invalidos|invalidas|obrigatorio|obrigatoria|obrigatorios|permissao|Horario|horario|sobreposicao)\b/;
// Mensagens são textos com espaço; nomes de campo e códigos não entram.
const MESSAGE =
  /"((?:[^"\\\n]|\\.)*\s(?:[^"\\\n]|\\.)*)"|`([^`\n]*\s[^`\n]*)`/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

describe("mensagens do backend", () => {
  it("são escritas com acento", () => {
    const found = sourceFiles(SOURCE).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(MESSAGE)]
        .map((match) => match[1] ?? match[2] ?? "")
        .filter((message) => UNACCENTED.test(message))
        .map((message) => `${file.slice(SOURCE.length + 1)}: ${message}`),
    );
    expect(found).toEqual([]);
  });
});
