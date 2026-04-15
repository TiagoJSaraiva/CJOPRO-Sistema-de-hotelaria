import { describe, expect, it } from "vitest";
import { ACTIVE_HOTEL_GLOBAL_VALUE, ACTIVE_HOTEL_HEADER_NAME, type SessionPayload } from "@hotel/shared";
import { resolveActiveHotelContext } from "../../../src/auth/activeHotel";

function createSession(roleAssignments: SessionPayload["roleAssignments"]): SessionPayload {
  return {
    id: "user-1",
    name: "Admin",
    email: "admin@example.com",
    tenantId: null,
    roles: ["Admin"],
    permissions: [],
    roleAssignments,
    iat: 1_700_000_000,
    exp: 4_700_000_000
  };
}

describe("auth/activeHotel", () => {
  it("retorna null quando usuario tem escopo global e nao envia header", () => {
    const session = createSession([
      { roleId: "r0", roleName: "Root", roleType: "SYSTEM_ROLE", hotelId: null, hotelName: null }
    ]);

    const result = resolveActiveHotelContext(session, {});

    expect(result).toEqual({ ok: true, activeHotelId: null });
  });

  it("retorna primeiro hotel acessivel quando usuario nao tem escopo global e nao envia header", () => {
    const session = createSession([
      { roleId: "r1", roleName: "Recepcao", roleType: "HOTEL_ROLE", hotelId: "hotel-z", hotelName: "Zeta" },
      { roleId: "r2", roleName: "Gerente", roleType: "HOTEL_ROLE", hotelId: "hotel-a", hotelName: "Alpha" }
    ]);

    const result = resolveActiveHotelContext(session, {});

    expect(result).toEqual({ ok: true, activeHotelId: "hotel-a" });
  });

  it("aceita header global apenas quando usuario possui escopo global", () => {
    const session = createSession([
      { roleId: "r1", roleName: "Recepcao", roleType: "HOTEL_ROLE", hotelId: "hotel-1", hotelName: "Alpha" }
    ]);

    const result = resolveActiveHotelContext(session, {
      [ACTIVE_HOTEL_HEADER_NAME]: ACTIVE_HOTEL_GLOBAL_VALUE
    });

    expect(result).toEqual({
      ok: false,
      statusCode: 403,
      message: "Contexto global nao permitido para este usuario."
    });
  });

  it("rejeita header de hotel sem acesso", () => {
    const session = createSession([
      { roleId: "r1", roleName: "Recepcao", roleType: "HOTEL_ROLE", hotelId: "hotel-1", hotelName: "Alpha" }
    ]);

    const result = resolveActiveHotelContext(session, {
      [ACTIVE_HOTEL_HEADER_NAME]: "hotel-999"
    });

    expect(result).toEqual({
      ok: false,
      statusCode: 403,
      message: "Hotel ativo nao permitido para este usuario."
    });
  });

  it("aceita hotel permitido informado no header", () => {
    const session = createSession([
      { roleId: "r1", roleName: "Recepcao", roleType: "HOTEL_ROLE", hotelId: "hotel-1", hotelName: "Alpha" }
    ]);

    const result = resolveActiveHotelContext(session, {
      [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1"
    });

    expect(result).toEqual({ ok: true, activeHotelId: "hotel-1" });
  });
});
