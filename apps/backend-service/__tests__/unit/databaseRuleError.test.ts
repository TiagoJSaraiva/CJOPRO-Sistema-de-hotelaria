import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../src/app";
import { databaseRuleError } from "../../src/common/databaseRuleError";

describe("databaseRuleError", () => {
  it.each([
    "cash_session_required",
    "cash_session_not_open",
    "cash_transaction_immutable",
    "insufficient_fefo_stock",
    "insufficient_explicit_lot_stock",
    "expiry_required",
  ])("traduz a recusa %s do banco", (code) => {
    expect(databaseRuleError({ message: code })).toMatchObject({
      code: "ADMIN_CONFLICT",
      details: code,
    });
  });

  it.each([
    [{ message: "permission denied for table users" }],
    [{ message: "constructor" }],
    [{ message: 42 }],
    [null],
    ["cash_session_required"],
  ])("não reinterpreta outros erros: %j", (error) => {
    expect(databaseRuleError(error)).toBeNull();
  });
});

describe("limite de erro da API", () => {
  let app: FastifyInstance;

  // Montar a aplicação registra todos os contratos, o que custa alguns segundos.
  beforeAll(async () => {
    app = createApp();
    app.get("/__teste-regra-de-caixa", async () => {
      throw Object.assign(new Error("cash_session_required"), {
        code: "P0001",
      });
    });
    app.get("/__teste-outra-falha", async () => {
      throw new Error("falha qualquer");
    });
    await app.ready();
  }, 120_000);
  afterAll(async () => {
    await app.close();
  });

  it("responde 409, com o código e a mensagem, à recusa do banco", async () => {
    const response = await app.inject({ url: "/__teste-regra-de-caixa" });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      details: "cash_session_required",
      message: expect.stringContaining("sessão de caixa"),
    });
  });

  it("mantém como falha interna o erro que não é regra de caixa", async () => {
    const response = await app.inject({ url: "/__teste-outra-falha" });
    expect(response.statusCode).toBe(500);
  });
});
