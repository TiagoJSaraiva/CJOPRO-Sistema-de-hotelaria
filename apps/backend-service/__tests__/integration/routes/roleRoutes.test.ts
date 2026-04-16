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
    roleAssignments: [{ roleId: "role-system", roleName: "Admin", roleType: "SYSTEM_ROLE", hotelId: null, hotelName: null }],
    iat: nowInSeconds,
    exp: nowInSeconds + 3600
  };

  return signToken(payload);
}

describe("routes/roles", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("retorna 401 para GET /admin/roles sem autenticacao", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin/roles"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED,
      message: "Token invalido ou expirado."
    });
  });

  it("retorna 403 para POST /admin/roles sem permissao de criacao", async () => {
    const token = createToken([PERMISSIONS.ROLE_READ]);

    const response = await app.inject({
      method: "POST",
      url: "/admin/roles",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        name: "Supervisor",
        role_type: "SYSTEM_ROLE",
        hotel_id: null,
        permission_ids: []
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      code: AUTH_ERROR_CODE.FORBIDDEN,
      message: "Sem permissao para executar esta operacao."
    });
  });

  it("retorna 400 quando nome obrigatorio nao e informado no cadastro de role", async () => {
    const token = createToken([PERMISSIONS.ROLE_CREATE]);

    const response = await app.inject({
      method: "POST",
      url: "/admin/roles",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        name: "",
        role_type: "SYSTEM_ROLE"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "ADMIN_VALIDATION_ERROR",
      message: "Nome da role e obrigatorio."
    });
  });

  it("retorna 403 quando usuario sem escopo global tenta acessar endpoint global", async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const token = signToken({
      id: "user-hotel",
      name: "Gestor Hotel",
      email: "gestor@hotel.com",
      tenantId: null,
      roles: ["Gestor Hotel"],
      permissions: [PERMISSIONS.ROLE_READ],
      roleAssignments: [
        {
          roleId: "role-hotel",
          roleName: "Gestor Hotel",
          roleType: "HOTEL_ROLE",
          hotelId: "hotel-1",
          hotelName: "Hotel Centro"
        }
      ],
      iat: nowInSeconds,
      exp: nowInSeconds + 3600
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin/roles",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      code: "ADMIN_SCOPE_NOT_ALLOWED",
      message: "Acesso global de sistema obrigatorio para esta operacao."
    });
  });
});