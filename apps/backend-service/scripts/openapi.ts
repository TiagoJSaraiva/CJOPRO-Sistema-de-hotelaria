import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import { createApp } from "../src/app";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const outputPath = path.join(workspaceRoot, "docs", "openapi.json");
const checkOnly = process.argv.includes("--check");
const EXPECTED_OPERATION_COUNT = 156;
const HTTP_METHODS = new Set([
  "get",
  "put",
  "post",
  "delete",
  "patch",
  "options",
  "head",
  "trace",
]);

function sortRecursively(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortRecursively);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortRecursively(item)]),
  );
}

function normalizeOpenApi30(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeOpenApi30);
  if (!value || typeof value !== "object") return value;

  const normalized = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      normalizeOpenApi30(item),
    ]),
  ) as Record<string, unknown>;

  if (typeof normalized.exclusiveMinimum === "number") {
    normalized.minimum = normalized.exclusiveMinimum;
    normalized.exclusiveMinimum = true;
  }

  if (Array.isArray(normalized.anyOf)) {
    const nonNull = normalized.anyOf.filter((item) => {
      return !(
        item &&
        typeof item === "object" &&
        (item as Record<string, unknown>).type === "null"
      );
    });

    if (nonNull.length !== normalized.anyOf.length) {
      delete normalized.anyOf;
      if (
        nonNull.length === 1 &&
        nonNull[0] &&
        typeof nonNull[0] === "object"
      ) {
        Object.assign(normalized, nonNull[0]);
      } else {
        normalized.anyOf = nonNull;
      }
      normalized.nullable = true;
    }
  }

  return normalized;
}

function assertOperationContract(document: Record<string, unknown>): void {
  const paths = document.paths as
    Record<string, Record<string, Record<string, unknown>>> | undefined;
  if (!paths) throw new Error("OpenAPI inválido: objeto paths ausente.");

  const operationIds = new Set<string>();
  let operationCount = 0;

  for (const [routePath, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      operationCount += 1;
      const operationId =
        typeof operation.operationId === "string" ? operation.operationId : "";
      if (!operationId)
        throw new Error(
          `OpenAPI inválido: ${method.toUpperCase()} ${routePath} sem operationId.`,
        );
      if (operationIds.has(operationId))
        throw new Error(
          `OpenAPI inválido: operationId duplicado (${operationId}).`,
        );
      if (!operation.responses || typeof operation.responses !== "object") {
        throw new Error(
          `OpenAPI inválido: ${method.toUpperCase()} ${routePath} sem respostas.`,
        );
      }
      operationIds.add(operationId);
    }
  }

  if (operationCount !== EXPECTED_OPERATION_COUNT) {
    throw new Error(
      `OpenAPI inválido: esperadas ${EXPECTED_OPERATION_COUNT} operações, encontradas ${operationCount}.`,
    );
  }
}

async function generateDocument(): Promise<string> {
  const app = createApp({ documentation: "openapi" });
  try {
    await app.ready();
    const document = normalizeOpenApi30(app.swagger()) as Record<
      string,
      unknown
    >;
    const paths = document.paths as Record<string, Record<string, any>>;
    const login429 = paths?.["/auth/login"]?.post?.responses?.["429"];
    if (login429) {
      login429.headers = {
        "Retry-After": {
          description: "Segundos até uma nova tentativa de login.",
          schema: { type: "integer", minimum: 1 },
        },
      };
    }

    assertOperationContract(document);
    await SwaggerParser.validate(document as any);
    return `${JSON.stringify(sortRecursively(document), null, 2)}\n`;
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  const generated = await generateDocument();

  if (checkOnly) {
    let current: string;
    try {
      current = await readFile(outputPath, "utf8");
    } catch {
      throw new Error("Contrato OpenAPI ausente. Execute `pnpm api:openapi`.");
    }

    if (current.replace(/\r\n/g, "\n") !== generated) {
      throw new Error(
        "Contrato OpenAPI desatualizado. Execute `pnpm api:openapi` e revise o diff.",
      );
    }
    process.stdout.write(
      `Contrato OpenAPI válido e sincronizado (${EXPECTED_OPERATION_COUNT} operações).\n`,
    );
    return;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generated, "utf8");
  process.stdout.write(
    `Contrato OpenAPI atualizado em ${path.relative(workspaceRoot, outputPath)} (${EXPECTED_OPERATION_COUNT} operações).\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
