import { describe, expect, it } from "vitest";
import type { AuthUser } from "@hotel/shared";
import {
  decodeActiveHotelCookie,
  encodeActiveHotelCookie,
  listAccessibleHotels,
  listActiveHotelOptions,
  resolveActiveHotelForUser,
  userCanAccessHotel
} from "../../../src/lib/activeHotel";

function createUser(roleAssignments: AuthUser["roleAssignments"]): AuthUser {
  return {
    id: "user-1",
    name: "User",
    email: "user@example.com",
    tenantId: null,
    roles: [],
    permissions: [],
    roleAssignments
  };
}

describe("lib/activeHotel", () => {
  it("deduplica hoteis por id e ordena alfabeticamente", () => {
    const user = createUser([
      { roleId: "r1", roleName: "Recepcao", roleType: "HOTEL_ROLE", hotelId: "h2", hotelName: "Zeta Hotel" },
      { roleId: "r2", roleName: "Gerente", roleType: "HOTEL_ROLE", hotelId: "h1", hotelName: "Alpha Hotel" },
      { roleId: "r3", roleName: "Owner", roleType: "HOTEL_ROLE", hotelId: "h2", hotelName: "Nome Ignorado" }
    ]);

    expect(listAccessibleHotels(user)).toEqual([
      { id: "h1", name: "Alpha Hotel" },
      { id: "h2", name: "Zeta Hotel" }
    ]);
  });

  it("inclui opcao global quando usuario tem role global", () => {
    const user = createUser([
      { roleId: "r0", roleName: "Root", roleType: "SYSTEM_ROLE", hotelId: null, hotelName: null },
      { roleId: "r2", roleName: "Gerente", roleType: "HOTEL_ROLE", hotelId: "h1", hotelName: "Alpha Hotel" }
    ]);

    expect(listActiveHotelOptions(user)).toEqual([
      { hotelId: null, label: "Sistema (todos os hoteis)" },
      { hotelId: "h1", label: "Alpha Hotel" }
    ]);
  });

  it("resolve hotel ativo preferindo cookie valido", () => {
    const user = createUser([
      { roleId: "r2", roleName: "Gerente", roleType: "HOTEL_ROLE", hotelId: "hotel-1", hotelName: "Alpha Hotel" },
      { roleId: "r3", roleName: "Dono", roleType: "HOTEL_ROLE", hotelId: "hotel-2", hotelName: "Beta Hotel" }
    ]);

    expect(resolveActiveHotelForUser(user, "hotel-2")).toBe("hotel-2");
  });

  it("resolve hotel ativo para o primeiro hotel quando usuario nao tem global", () => {
    const user = createUser([
      { roleId: "r2", roleName: "Gerente", roleType: "HOTEL_ROLE", hotelId: "hotel-z", hotelName: "Zeta" },
      { roleId: "r3", roleName: "Dono", roleType: "HOTEL_ROLE", hotelId: "hotel-a", hotelName: "Alpha" }
    ]);

    expect(resolveActiveHotelForUser(user, undefined)).toBe("hotel-a");
    expect(resolveActiveHotelForUser(user, null)).toBe("hotel-a");
  });

  it("resolve hotel ativo para global quando usuario possui acesso global e cookie e invalido", () => {
    const user = createUser([
      { roleId: "r0", roleName: "Root", roleType: "SYSTEM_ROLE", hotelId: null, hotelName: null },
      { roleId: "r2", roleName: "Gerente", roleType: "HOTEL_ROLE", hotelId: "hotel-1", hotelName: "Alpha Hotel" }
    ]);

    expect(resolveActiveHotelForUser(user, "hotel-invalido")).toBeNull();
  });

  it("valida acesso de hotel por role assignment", () => {
    const user = createUser([
      { roleId: "r0", roleName: "Root", roleType: "SYSTEM_ROLE", hotelId: null, hotelName: null },
      { roleId: "r2", roleName: "Gerente", roleType: "HOTEL_ROLE", hotelId: "hotel-1", hotelName: "Alpha Hotel" }
    ]);

    expect(userCanAccessHotel(user, null)).toBe(true);
    expect(userCanAccessHotel(user, "hotel-1")).toBe(true);
    expect(userCanAccessHotel(user, "hotel-2")).toBe(false);
  });

  it("codifica e decodifica cookie de hotel ativo", () => {
    expect(encodeActiveHotelCookie(null)).toBe("__global__");
    expect(decodeActiveHotelCookie("__global__")).toBeNull();
    expect(decodeActiveHotelCookie("hotel-1")).toBe("hotel-1");
    expect(decodeActiveHotelCookie("")).toBeUndefined();
  });
});
