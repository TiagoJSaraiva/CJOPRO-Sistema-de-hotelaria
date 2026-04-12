import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { AUTH_ERROR_CODE, PERMISSIONS, type SessionPayload } from "@hotel/shared";
import { createApp } from "../../../src/app";
import { signToken } from "../../../src/auth/session";

function createToken(permissions: string[]): string {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  const payload: SessionPayload = {
    id: "user-1",
    name: "Admin",
    email: "admin@example.com",
    tenantId: null,
    roles: ["Admin"],
    permissions,
    roleAssignments: [],
    iat: nowInSeconds,
    exp: nowInSeconds + 3600
  };

  return signToken(payload);
}

describe("routes/users", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("retorna 401 para GET /admin/users sem autenticacao", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin/users"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED,
      message: "Token invalido ou expirado."
    });
  });

  it("retorna 403 para POST /admin/users sem permissao de criacao", async () => {
    const token = createToken([PERMISSIONS.USER_READ]);

    const response = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        name: "Operador",
        email: "op@hotel.com",
        password_hash: "tmp123"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      code: AUTH_ERROR_CODE.FORBIDDEN,
      message: "Sem permissao para executar esta operacao."
    });
  });

  it("retorna 400 quando faltam campos obrigatorios no cadastro de usuario", async () => {
    const token = createToken([PERMISSIONS.USER_CREATE]);

    const response = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        name: ""
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: "Nome, email e senha temporaria sao obrigatorios."
    });
  });
});