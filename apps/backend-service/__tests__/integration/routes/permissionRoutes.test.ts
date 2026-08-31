import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  AUTH_ERROR_CODE,
  AUTH_ERROR_MESSAGE,
  PERMISSIONS,
  type SessionPayload,
} from "@hotel/shared";
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
    roleAssignments: [
      {
        roleId: "role-system",
        roleName: "Admin",
        roleType: "SYSTEM_ROLE",
        hotelId: null,
        hotelName: null,
      },
    ],
    iat: nowInSeconds,
    exp: nowInSeconds + 3600,
  };

  return signToken(payload);
}

describe("routes/permissions", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("retorna 401 para GET /admin/permissions sem autenticacao", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin/permissions",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED,
      message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED],
    });
  });

  it("retorna 403 para POST /admin/permissions sem permissao de criacao", async () => {
    const token = createToken([PERMISSIONS.PERMISSION_READ]);

    const response = await app.inject({
      method: "POST",
      url: "/admin/permissions",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "hotel_manage",
        type: "SYSTEM_PERMISSION",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      code: AUTH_ERROR_CODE.FORBIDDEN,
      message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.FORBIDDEN],
    });
  });

  it("retorna 400 quando nome obrigatorio nao e informado no cadastro de permissao", async () => {
    const token = createToken([PERMISSIONS.PERMISSION_CREATE]);

    const response = await app.inject({
      method: "POST",
      url: "/admin/permissions",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "",
        type: "SYSTEM_PERMISSION",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "ADMIN_VALIDATION_ERROR",
      message: "Nome da permissao e obrigatorio.",
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
      permissions: [PERMISSIONS.PERMISSION_READ],
      roleAssignments: [
        {
          roleId: "role-hotel",
          roleName: "Gestor Hotel",
          roleType: "HOTEL_ROLE",
          hotelId: "hotel-1",
          hotelName: "Hotel Centro",
        },
      ],
      iat: nowInSeconds,
      exp: nowInSeconds + 3600,
    });

    const response = await app.inject({
      method: "GET",
      url: "/admin/permissions",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      code: "ADMIN_SCOPE_NOT_ALLOWED",
      message: "Acesso global de sistema obrigatorio para esta operacao.",
    });
  });
});
