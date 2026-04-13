import { describe, expect, it } from "vitest";
import type { AdminPermission } from "@hotel/shared";
import {
  DEFAULT_PERMISSION_VIEW_FILTERS,
  applyPermissionViewFilters,
  countAppliedPermissionFilters
} from "../../../../src/app/dashboard/permissions/_components/permissionViewFilters";

describe("permissionViewFilters", () => {
  const permissions: AdminPermission[] = [
    { id: "p-1", name: "USER_READ" },
    { id: "p-2", name: "USER_UPDATE" },
    { id: "p-3", name: "HOTEL_CREATE" }
  ];

  it("retorna todas as permissoes sem filtro", () => {
    const result = applyPermissionViewFilters(permissions, DEFAULT_PERMISSION_VIEW_FILTERS);

    expect(result.map((item) => item.id)).toEqual(["p-1", "p-2", "p-3"]);
  });

  it("filtra por nome sem diferenciar maiusculas e minusculas", () => {
    const result = applyPermissionViewFilters(permissions, {
      search: "user"
    });

    expect(result.map((item) => item.id)).toEqual(["p-1", "p-2"]);
  });

  it("conta corretamente filtros aplicados", () => {
    expect(countAppliedPermissionFilters({ search: "" })).toBe(0);
    expect(countAppliedPermissionFilters({ search: "hotel" })).toBe(1);
  });
});
