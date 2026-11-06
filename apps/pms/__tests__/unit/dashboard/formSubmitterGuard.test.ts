import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const source = join(dirname(fileURLToPath(import.meta.url)), "../../../src");

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

/**
 * Um campo `name="id"` sobrescreve a propriedade `form.id` do DOM. O React usa essa propriedade
 * ao incluir o botão que enviou o formulário e, enganado, grava um `form` inválido no campo: o
 * valor do botão não chega à Server Action. Já fez "Rejeitar" aprovar uma apuração (QA-047).
 */
it("nenhum formulário com botão nomeado tem um campo chamado id", () => {
  const offenders = tsxFiles(source).flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return [...text.matchAll(/<form\b[\s\S]*?<\/form>/g)]
      .filter(
        ([form]) =>
          /\bname="id"/.test(form) &&
          /<(button|ConfirmSubmitButton)\b[^>]*?\bname=/s.test(form),
      )
      .map((match) => {
        const line = text.slice(0, match.index).split("\n").length;
        return `${relative(source, file).replaceAll("\\", "/")}:${line}`;
      });
  });
  expect(offenders).toEqual([]);
});
