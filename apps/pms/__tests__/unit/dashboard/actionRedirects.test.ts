import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Usa o `redirect` verdadeiro do Next: ele avisa o destino lançando uma exceção, e é justamente
// isso que um `catch` engole quando o redirect fica dentro do `try`.
const mocks = vi.hoisted(() => ({ request: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("../../../src/lib/adminApi", () => ({
  requestOperationsFinanceEndpoint: mocks.request,
}));

import {
  actOrganizationAction,
  createOrganizationAction,
} from "../../../src/app/dashboard/organizations/actions";
import { reconcileProcurementAction } from "../../../src/app/dashboard/procurement/actions";

async function destination(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
  } catch (error) {
    const digest = (error as { digest?: string }).digest || "";
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2] ?? "";
    throw error;
  }
  throw new Error("a ação não redirecionou");
}

const source = join(dirname(fileURLToPath(import.meta.url)), "../../../src");

function serverActionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return serverActionFiles(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    return /^\s*["']use server["']/.test(readFileSync(path, "utf8"))
      ? [path]
      : [];
  });
}

function redirectingHelpers(file: ts.SourceFile): Set<string> {
  const helpers = new Set(["redirect"]);
  ts.forEachChild(file, (node) => {
    const name = ts.isFunctionDeclaration(node)
      ? node.name?.text
      : ts.isVariableStatement(node)
        ? node.declarationList.declarations[0]?.name.getText()
        : undefined;
    if (name && node.getText().includes("redirect(")) helpers.add(name);
  });
  return helpers;
}

describe("o redirect de sucesso sobrevive ao tratamento de erro", () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.request.mockResolvedValue({});
  });

  it("compras informa sucesso quando a operação dá certo", async () => {
    expect(await destination(reconcileProcurementAction)).toBe(
      "/dashboard/procurement?status=updated",
    );
  });

  it("compras informa falha quando o backend recusa", async () => {
    mocks.request.mockRejectedValue(
      Object.assign(new Error("Recusado"), { statusCode: 409 }),
    );
    expect(await destination(reconcileProcurementAction)).toBe(
      "/dashboard/procurement?status=conflict",
    );
  });

  it("organizações informa sucesso ao criar", async () => {
    const form = new FormData();
    form.set("legal_name", "Fornecedora Exemplo");
    expect(await destination(() => createOrganizationAction(form))).toBe(
      "/dashboard/organizations?status=created",
    );
  });

  it("organizações informa sucesso ao agir sobre um cadastro", async () => {
    const form = new FormData();
    form.set("id", "org");
    form.set("version", "1");
    form.set("action", "approve");
    expect(await destination(() => actOrganizationAction(form))).toBe(
      "/dashboard/organizations?status=updated",
    );
  });

  it("organizações informa a falha e mantém o cadastro aberto", async () => {
    mocks.request.mockRejectedValue(
      Object.assign(new Error("Recusado"), { statusCode: 409 }),
    );
    const form = new FormData();
    form.set("id", "org");
    expect(await destination(() => actOrganizationAction(form))).toBe(
      "/dashboard/organizations?id=org&status=conflict",
    );
  });

  /**
   * `redirect` termina lançando uma exceção. Dentro de um `try`, o `catch` a confunde com uma falha:
   * em compras e organizações, toda ação bem-sucedida era mostrada como conflito (QA-060).
   */
  it("nenhuma Server Action redireciona de dentro de um try", () => {
    const offenders = serverActionFiles(source).flatMap((path) => {
      const file = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const helpers = redirectingHelpers(file);
      const found: string[] = [];
      const inspect = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const callee = node.expression.getText();
          if (helpers.has(callee)) {
            const { line } = file.getLineAndCharacterOfPosition(
              node.getStart(),
            );
            found.push(`${relative(source, path)}:${line + 1}`);
          }
        }
        ts.forEachChild(node, inspect);
      };
      const visit = (node: ts.Node) => {
        if (ts.isTryStatement(node) && node.catchClause) inspect(node.tryBlock);
        ts.forEachChild(node, visit);
      };
      visit(file);
      return found;
    });
    expect(offenders).toEqual([]);
  });
});
