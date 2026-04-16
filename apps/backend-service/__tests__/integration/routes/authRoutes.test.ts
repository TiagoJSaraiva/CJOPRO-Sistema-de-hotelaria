import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

vi.mock("@hotel/shared", async () => {
  const actual = await vi.importActual<typeof import("@hotel/shared")>("@hotel/shared");

  return {
    ...actual,
    createServerClient: vi.fn()
  };
});

import { ACTIVE_HOTEL_HEADER_NAME, AUTH_ERROR_CODE, PERMISSIONS, createServerClient, type SessionPayload } from "@hotel/shared";
import { createApp } from "../../../src/app";
import { hashTemporaryPassword, signToken, verifyToken } from "../../../src/auth/session";

function createLoginSupabaseMock(options: {
  userRow: any;
  userError: { code?: string } | null;
  updateError?: { code?: string } | null;
}) {
  const single = vi.fn(async () => ({ data: options.userRow, error: options.userError }));
  const eqForSelect = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq: eqForSelect }));

  const updateEq = vi.fn(async () => ({ error: options.updateError || null }));
  const update = vi.fn(() => ({ eq: updateEq }));

  const from = vi.fn(() => ({
    select,
    update
  }));

  return {
    from,
    select,
    update,
    updateEq
  };
}

const nowInSeconds = Math.floor(Date.now() / 1000);

const mePayload: SessionPayload = {
  id: "user-1",
  name: "Admin",
  email: "admin@example.com",
  tenantId: null,
  roles: ["Admin"],
  permissions: [PERMISSIONS.USER_READ],
  roleAssignments: [],
  iat: nowInSeconds,
  exp: nowInSeconds + 3600
};

describe("routes/auth", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 400 quando campos obrigatorios nao sao enviados no login", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: AUTH_ERROR_CODE.MISSING_FIELDS,
      message: "Email e senha sao obrigatorios."
    });
  });

  it("retorna 401 quando usuario nao e encontrado", async () => {
    const supabase = createLoginSupabaseMock({
      userRow: null,
      userError: { code: "PGRST116" }
    });

    vi.mocked(createServerClient).mockReturnValue(supabase as any);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "admin@example.com",
        password: "Secret#123"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: AUTH_ERROR_CODE.INVALID_CREDENTIALS,
      message: "Credenciais invalidas."
    });
  });

  it("retorna token e usuario quando credenciais sao validas", async () => {
    const passwordHash = await hashTemporaryPassword("Secret#123");

    const supabase = createLoginSupabaseMock({
      userRow: {
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
        is_active: true,
        password_hash: passwordHash,
        failed_attempts: 0,
        locked_until: null,
        user_roles: [
          {
            roles: {
              id: "role-1",
              name: "Administrador",
              role_type: "SYSTEM_ROLE",
              hotel_id: null,
              hotels: { name: null },
              role_permissions: [{ permissions: { name: PERMISSIONS.USER_READ } }]
            }
          }
        ]
      },
      userError: null
    });

    vi.mocked(createServerClient).mockReturnValue(supabase as any);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "ADMIN@EXAMPLE.COM",
        password: "Secret#123"
      }
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.expiresIn).toBeGreaterThan(0);
    expect(body.user).toEqual({
      id: "user-1",
      name: "Admin",
      email: "admin@example.com",
      tenantId: null,
      roles: ["Administrador"],
      permissions: [PERMISSIONS.USER_READ],
      roleAssignments: [
        {
          roleId: "role-1",
          roleName: "Administrador",
          roleType: "SYSTEM_ROLE",
          hotelId: null,
          hotelName: null,
          permissions: [PERMISSIONS.USER_READ]
        }
      ]
    });
    expect(verifyToken(body.token)).not.toBeNull();
    expect(supabase.update).toHaveBeenCalled();
    expect(supabase.updateEq).toHaveBeenCalledWith("id", "user-1");
  });

  it("retorna hotel do assignment para role generica vinculada por user_roles", async () => {
    const passwordHash = await hashTemporaryPassword("Secret#123");

    const supabase = createLoginSupabaseMock({
      userRow: {
        id: "user-1",
        name: "Gestor",
        email: "gestor@example.com",
        is_active: true,
        password_hash: passwordHash,
        failed_attempts: 0,
        locked_until: null,
        user_roles: [
          {
            hotel_id: "hotel-legal-id",
            hotels: { name: "Hotel Legal" },
            roles: {
              id: "role-gestor",
              name: "Gestor de Hotel",
              role_type: "HOTEL_ROLE",
              hotel_id: null,
              hotels: { name: null },
              role_permissions: [{ permissions: { name: PERMISSIONS.USER_READ } }]
            }
          }
        ]
      },
      userError: null
    });

    vi.mocked(createServerClient).mockReturnValue(supabase as any);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "gestor@example.com",
        password: "Secret#123"
      }
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.user.roleAssignments).toEqual([
      {
        roleId: "role-gestor",
        roleName: "Gestor de Hotel",
        roleType: "HOTEL_ROLE",
        hotelId: "hotel-legal-id",
        hotelName: "Hotel Legal",
        permissions: [PERMISSIONS.USER_READ]
      }
    ]);
  });

  it("retorna 429 quando usuario esta temporariamente bloqueado", async () => {
    const passwordHash = await hashTemporaryPassword("Secret#123");
    const lockedUntil = new Date(Date.now() + 120_000).toISOString();
    const supabase = createLoginSupabaseMock({
      userRow: {
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
        is_active: true,
        password_hash: passwordHash,
        failed_attempts: 10,
        locked_until: lockedUntil,
        user_roles: []
      },
      userError: null
    });

    vi.mocked(createServerClient).mockReturnValue(supabase as any);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "admin@example.com",
        password: "Secret#123"
      }
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({
      code: AUTH_ERROR_CODE.ACCOUNT_LOCKED,
      message: "Conta temporariamente bloqueada por tentativas de login invalidas."
    });
  });

  it("retorna 401 no /auth/me sem token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/auth/me"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED,
      message: "Token invalido ou expirado."
    });
  });

  it("retorna usuario no /auth/me quando token e valido", async () => {
    const token = signToken(mePayload);

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: mePayload.id,
        name: mePayload.name,
        email: mePayload.email,
        tenantId: mePayload.tenantId,
        roles: mePayload.roles,
        permissions: mePayload.permissions,
        roleAssignments: mePayload.roleAssignments
      }
    });
  });

  it("recorta permissoes no /auth/me pelo hotel ativo selecionado", async () => {
    const token = signToken({
      ...mePayload,
      roles: ["System Admin", "Gestor Hotel Legal"],
      permissions: [PERMISSIONS.PERMISSION_CREATE, PERMISSIONS.USER_READ],
      roleAssignments: [
        {
          roleId: "role-system",
          roleName: "System Admin",
          roleType: "SYSTEM_ROLE",
          hotelId: null,
          hotelName: null,
          permissions: [PERMISSIONS.PERMISSION_CREATE]
        },
        {
          roleId: "role-hotel",
          roleName: "Gestor Hotel Legal",
          roleType: "HOTEL_ROLE",
          hotelId: "hotel-legal-id",
          hotelName: "Hotel Legal",
          permissions: [PERMISSIONS.USER_READ]
        }
      ]
    });

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: `Bearer ${token}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-legal-id"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
        tenantId: null,
        roles: ["Gestor Hotel Legal"],
        permissions: [PERMISSIONS.USER_READ],
        roleAssignments: [
          {
            roleId: "role-system",
            roleName: "System Admin",
            roleType: "SYSTEM_ROLE",
            hotelId: null,
            hotelName: null,
            permissions: [PERMISSIONS.PERMISSION_CREATE]
          },
          {
            roleId: "role-hotel",
            roleName: "Gestor Hotel Legal",
            roleType: "HOTEL_ROLE",
            hotelId: "hotel-legal-id",
            hotelName: "Hotel Legal",
            permissions: [PERMISSIONS.USER_READ]
          }
        ]
      }
    });
  });
});