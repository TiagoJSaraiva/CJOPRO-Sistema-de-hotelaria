import { describe, expect, it } from "vitest";
import type { AdminRole } from "@hotel/shared";
import { DEFAULT_ROLE_VIEW_FILTERS, applyRoleViewFilters, countAppliedRoleFilters } from "../../../../src/app/dashboard/roles/_components/roleViewFilters";

function makeRole(overrides: Partial<AdminRole>): AdminRole {
  return {
    id: overrides.id || "role-default",
    name: overrides.name || "Role",
    role_type: overrides.role_type || "SYSTEM_ROLE",
    hotel_id: overrides.hotel_id ?? null,
    hotel_name: overrides.hotel_name ?? null,
    permissions: overrides.permissions || []
  };
}

describe("roleViewFilters", () => {
  const roles: AdminRole[] = [
    makeRole({
      id: "role-1",
      name: "Admin Centro",
      role_type: "HOTEL_ROLE",
      hotel_id: "hotel-centro",
      hotel_name: "Hotel Centro",
      permissions: [
        { id: "perm-users", name: "USER_MANAGE", type: "HOTEL_PERMISSION" },
        { id: "perm-report", name: "REPORT_VIEW", type: "HOTEL_PERMISSION" }
      ]
    }),
    makeRole({
      id: "role-2",
      name: "Recepcao Praia",
      role_type: "HOTEL_ROLE",
      hotel_id: "hotel-praia",
      hotel_name: "Hotel Praia",
      permissions: [{ id: "perm-checkin", name: "CHECKIN_MANAGE", type: "HOTEL_PERMISSION" }]
    }),
    makeRole({
      id: "role-3",
      name: "Auditoria Global",
      role_type: "SYSTEM_ROLE",
      hotel_id: null,
      hotel_name: null,
      permissions: [{ id: "perm-report", name: "REPORT_VIEW", type: "SYSTEM_PERMISSION" }]
    })
  ];

  it("retorna todas as roles sem filtros", () => {
    const result = applyRoleViewFilters(roles, DEFAULT_ROLE_VIEW_FILTERS);

    expect(result.map((item) => item.id)).toEqual(["role-1", "role-2", "role-3"]);
  });

  it("filtra por nome sem diferenciar maiusculas e minusculas", () => {
    const result = applyRoleViewFilters(roles, {
      ...DEFAULT_ROLE_VIEW_FILTERS,
      roleType: "",
      search: "AUDITORIA"
    });

    expect(result.map((item) => item.id)).toEqual(["role-3"]);
  });

  it("filtra por hotel", () => {
    const result = applyRoleViewFilters(roles, {
      ...DEFAULT_ROLE_VIEW_FILTERS,
      roleType: "",
      hotelId: "hotel-centro"
    });

    expect(result.map((item) => item.id)).toEqual(["role-1"]);
  });

  it("filtra por permissao vinculada", () => {
    const result = applyRoleViewFilters(roles, {
      ...DEFAULT_ROLE_VIEW_FILTERS,
      roleType: "",
      permissionId: "perm-checkin"
    });

    expect(result.map((item) => item.id)).toEqual(["role-2"]);
  });

  it("combina filtros com regra AND", () => {
    const result = applyRoleViewFilters(roles, {
      ...DEFAULT_ROLE_VIEW_FILTERS,
      search: "admin",
      roleType: "HOTEL_ROLE",
      hotelId: "hotel-centro",
      permissionId: "perm-users"
    });

    expect(result.map((item) => item.id)).toEqual(["role-1"]);
  });

  it("conta filtros aplicados", () => {
    const count = countAppliedRoleFilters({
      ...DEFAULT_ROLE_VIEW_FILTERS,
      search: "admin",
      roleType: "HOTEL_ROLE",
      permissionId: "perm-users"
    });

    expect(count).toBe(3);
  });

  it("filtra por tipo da role", () => {
    const result = applyRoleViewFilters(roles, {
      ...DEFAULT_ROLE_VIEW_FILTERS,
      roleType: "SYSTEM_ROLE"
    });

    expect(result.map((item) => item.id)).toEqual(["role-3"]);
  });
});
