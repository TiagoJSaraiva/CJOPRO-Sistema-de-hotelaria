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

describe("routes/hotels", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createApp();
    await app.ready();
  }, 90_000);

  afterAll(async () => {
    await app.close();
  });

  it("retorna 401 para GET /admin/hotels sem autenticacao", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/admin/hotels",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED,
      message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED],
    });
  });

  it("retorna 403 para POST /admin/hotels sem permissao de criacao", async () => {
    const token = createToken([PERMISSIONS.HOTEL_READ]);

    const response = await app.inject({
      method: "POST",
      url: "/admin/hotels",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "Hotel Centro",
        legal_name: "Hotel Centro LTDA",
        tax_id: "04.252.011/0001-10",
        slug: "hotel-centro",
        email: "contato@hotel.com",
        phone: "11999999999",
        address_line: "Rua Central",
        address_number: "100",
        address_complement: null,
        district: "Centro",
        city: "Sao Paulo",
        state: "SP",
        country: "BR",
        zip_code: "01001-000",
        timezone: null,
        currency: null,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      code: AUTH_ERROR_CODE.FORBIDDEN,
      message: AUTH_ERROR_MESSAGE[AUTH_ERROR_CODE.FORBIDDEN],
    });
  });

  it("retorna 400 quando faltam campos obrigatorios no cadastro de hotel", async () => {
    const token = createToken([PERMISSIONS.HOTEL_CREATE]);

    const response = await app.inject({
      method: "POST",
      url: "/admin/hotels",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "Hotel Centro",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "ADMIN_VALIDATION_ERROR",
      message: "Dados inválidos para a requisição.",
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
      permissions: [PERMISSIONS.HOTEL_READ],
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
      url: "/admin/hotels",
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

  it("retorna 400 quando CNPJ invalido e enviado para pais BR", async () => {
    const token = createToken([PERMISSIONS.HOTEL_CREATE]);

    const response = await app.inject({
      method: "POST",
      url: "/admin/hotels",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "Hotel Centro",
        legal_name: "Hotel Centro LTDA",
        tax_id: "23.636.568/0001-30", // CNPJ inválido: dígitos verificadores deveriam ser 07, não 30
        slug: "hotel-centro",
        email: "contato@hotel.com",
        phone: "11999999999",
        address_line: "Rua Central",
        address_number: "100",
        address_complement: null,
        district: "Centro",
        city: "Sao Paulo",
        state: "SP",
        country: "BR",
        zip_code: "01001-000",
        timezone: null,
        currency: null,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("ADMIN_VALIDATION_ERROR");
    expect(response.json().message).toBe(
      "CNPJ inválido para o país informado.",
    );
  });
});
