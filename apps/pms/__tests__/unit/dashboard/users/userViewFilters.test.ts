import { describe, expect, it } from "vitest";
import type { AdminUser } from "@hotel/shared";
import { DEFAULT_USER_VIEW_FILTERS, applyUserViewFilters, countAppliedUserFilters } from "../../../../src/app/dashboard/users/_components/userViewFilters";

function makeUser(overrides: Partial<AdminUser>): AdminUser {
  const hasCreatedAt = Object.prototype.hasOwnProperty.call(overrides, "created_at");
  const hasLastLoginAt = Object.prototype.hasOwnProperty.call(overrides, "last_login_at");

  return {
    id: overrides.id || "user-default",
    name: overrides.name || "Usuario",
    email: overrides.email || "usuario@hotel.com",
    is_active: overrides.is_active ?? true,
    created_at: hasCreatedAt ? (overrides.created_at ?? null) : "2026-01-15T10:00:00.000Z",
    last_login_at: hasLastLoginAt ? (overrides.last_login_at ?? null) : null,
    role_assignments: overrides.role_assignments || []
  };
}

describe("userViewFilters", () => {
  const users: AdminUser[] = [
    makeUser({
      id: "u-1",
      name: "Maria Silva",
      email: "maria@hotel.com",
      is_active: true,
      created_at: "2026-01-10T10:30:00.000Z",
      role_assignments: [
        { role_id: "role-admin", role_name: "Admin", role_type: "HOTEL_ROLE", hotel_id: "hotel-centro", hotel_name: "Hotel Centro" },
        { role_id: "role-auditor", role_name: "Auditor", role_type: "SYSTEM_ROLE", hotel_id: null, hotel_name: "Sistema" }
      ]
    }),
    makeUser({
      id: "u-2",
      name: "Joao Pereira",
      email: "joao@praia.com",
      is_active: false,
      created_at: "2026-02-20T16:45:00.000Z",
      role_assignments: [{ role_id: "role-recepcao", role_name: "Recepcao", role_type: "HOTEL_ROLE", hotel_id: "hotel-praia", hotel_name: "Hotel Praia" }]
    }),
    makeUser({
      id: "u-3",
      name: "Marina Costa",
      email: "marina@hotel.com",
      is_active: true,
      created_at: null,
      role_assignments: [
        { role_id: "role-admin", role_name: "Admin", role_type: "HOTEL_ROLE", hotel_id: "hotel-praia", hotel_name: "Hotel Praia" },
        { role_id: "role-recepcao", role_name: "Recepcao", role_type: "HOTEL_ROLE", hotel_id: "hotel-centro", hotel_name: "Hotel Centro" }
      ]
    })
  ];

  it("retorna todos os usuarios quando nao ha filtros", () => {
    const result = applyUserViewFilters(users, DEFAULT_USER_VIEW_FILTERS);

    expect(result.map((item) => item.id)).toEqual(["u-1", "u-2", "u-3"]);
  });

  it("filtra por nome ou email sem diferenciar maiusculas e minusculas", () => {
    const result = applyUserViewFilters(users, {
      ...DEFAULT_USER_VIEW_FILTERS,
      search: "MARIA"
    });

    expect(result.map((item) => item.id)).toEqual(["u-1"]);
  });

  it("aplica status e combinacao hotel+role com regra AND na mesma atribuicao", () => {
    const result = applyUserViewFilters(users, {
      ...DEFAULT_USER_VIEW_FILTERS,
      status: "active",
      hotelId: "hotel-praia",
      roleId: "role-admin"
    });

    expect(result.map((item) => item.id)).toEqual(["u-3"]);
  });

  it("nao mistura hotel e role de atribuicoes diferentes", () => {
    const result = applyUserViewFilters(users, {
      ...DEFAULT_USER_VIEW_FILTERS,
      hotelId: "hotel-centro",
      roleId: "role-admin"
    });

    expect(result.map((item) => item.id)).toEqual(["u-1"]);
  });

  it("aplica filtro de periodo de criacao de forma inclusiva", () => {
    const result = applyUserViewFilters(users, {
      ...DEFAULT_USER_VIEW_FILTERS,
      createdFrom: "2026-02-20",
      createdTo: "2026-02-20"
    });

    expect(result.map((item) => item.id)).toEqual(["u-2"]);
  });

  it("exclui usuario sem data de criacao quando filtro de data esta ativo", () => {
    const result = applyUserViewFilters(users, {
      ...DEFAULT_USER_VIEW_FILTERS,
      createdFrom: "2026-01-01"
    });

    expect(result.map((item) => item.id)).toEqual(["u-1", "u-2"]);
  });

  it("conta corretamente a quantidade de filtros aplicados", () => {
    const count = countAppliedUserFilters({
      ...DEFAULT_USER_VIEW_FILTERS,
      search: "maria",
      status: "active",
      hotelId: "hotel-centro",
      createdTo: "2026-12-31"
    });

    expect(count).toBe(4);
  });
});
