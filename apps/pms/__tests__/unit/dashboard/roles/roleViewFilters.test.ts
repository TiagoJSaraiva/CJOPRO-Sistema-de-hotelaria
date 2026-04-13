import { describe, expect, it } from "vitest";
import type { AdminRole } from "@hotel/shared";
import { DEFAULT_ROLE_VIEW_FILTERS, applyRoleViewFilters, countAppliedRoleFilters } from "../../../../src/app/dashboard/roles/_components/roleViewFilters";

function makeRole(overrides: Partial<AdminRole>): AdminRole {
  return {
    id: overrides.id || "role-default",
    name: overrides.name || "Role",
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
      hotel_id: "hotel-centro",
      hotel_name: "Hotel Centro",
      permissions: [
        { id: "perm-users", name: "USER_MANAGE" },
        { id: "perm-report", name: "REPORT_VIEW" }
      ]
    }),
    makeRole({
      id: "role-2",
      name: "Recepcao Praia",
      hotel_id: "hotel-praia",
      hotel_name: "Hotel Praia",
      permissions: [{ id: "perm-checkin", name: "CHECKIN_MANAGE" }]
    }),
    makeRole({
      id: "role-3",
      name: "Auditoria Global",
      hotel_id: null,
      hotel_name: null,
      permissions: [{ id: "perm-report", name: "REPORT_VIEW" }]
    })
  ];

  it("retorna todas as roles sem filtros", () => {
    const result = applyRoleViewFilters(roles, DEFAULT_ROLE_VIEW_FILTERS);

    expect(result.map((item) => item.id)).toEqual(["role-1", "role-2", "role-3"]);
  });

  it("filtra por nome sem diferenciar maiusculas e minusculas", () => {
    const result = applyRoleViewFilters(roles, {
      ...DEFAULT_ROLE_VIEW_FILTERS,
      search: "AUDITORIA"
    });

    expect(result.map((item) => item.id)).toEqual(["role-3"]);
  });

  it("filtra por hotel", () => {
    const result = applyRoleViewFilters(roles, {
      ...DEFAULT_ROLE_VIEW_FILTERS,
      hotelId: "hotel-centro"
    });

    expect(result.map((item) => item.id)).toEqual(["role-1"]);
  });

  it("filtra por permissao vinculada", () => {
    const result = applyRoleViewFilters(roles, {
      ...DEFAULT_ROLE_VIEW_FILTERS,
      permissionId: "perm-checkin"
    });

    expect(result.map((item) => item.id)).toEqual(["role-2"]);
  });

  it("combina filtros com regra AND", () => {
    const result = applyRoleViewFilters(roles, {
      ...DEFAULT_ROLE_VIEW_FILTERS,
      search: "admin",
      hotelId: "hotel-centro",
      permissionId: "perm-users"
    });

    expect(result.map((item) => item.id)).toEqual(["role-1"]);
  });

  it("conta filtros aplicados", () => {
    const count = countAppliedRoleFilters({
      ...DEFAULT_ROLE_VIEW_FILTERS,
      search: "admin",
      permissionId: "perm-users"
    });

    expect(count).toBe(2);
  });
});
