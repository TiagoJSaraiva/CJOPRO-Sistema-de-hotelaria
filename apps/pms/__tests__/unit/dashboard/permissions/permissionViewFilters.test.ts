import { describe, expect, it } from "vitest";
import type { AdminPermission } from "@hotel/shared";
import {
  DEFAULT_PERMISSION_VIEW_FILTERS,
  applyPermissionViewFilters,
  countAppliedPermissionFilters
} from "../../../../src/app/dashboard/permissions/_components/permissionViewFilters";

describe("permissionViewFilters", () => {
  const permissions: AdminPermission[] = [
    { id: "p-1", name: "USER_READ", type: "SYSTEM_PERMISSION" },
    { id: "p-2", name: "USER_UPDATE", type: "SYSTEM_PERMISSION" },
    { id: "p-3", name: "BOOKING_CREATE", type: "HOTEL_PERMISSION" }
  ];

  it("retorna todas as permissoes sem filtro", () => {
    const result = applyPermissionViewFilters(permissions, DEFAULT_PERMISSION_VIEW_FILTERS);

    expect(result.map((item) => item.id)).toEqual(["p-1", "p-2", "p-3"]);
  });

  it("filtra por nome sem diferenciar maiusculas e minusculas", () => {
    const result = applyPermissionViewFilters(permissions, {
      search: "user",
      type: ""
    });

    expect(result.map((item) => item.id)).toEqual(["p-1", "p-2"]);
  });

  it("conta corretamente filtros aplicados", () => {
    expect(countAppliedPermissionFilters({ search: "", type: "" })).toBe(0);
    expect(countAppliedPermissionFilters({ search: "booking", type: "HOTEL_PERMISSION" })).toBe(2);
  });

  it("filtra por tipo de permissao", () => {
    const result = applyPermissionViewFilters(permissions, {
      search: "",
      type: "HOTEL_PERMISSION"
    });

    expect(result.map((item) => item.id)).toEqual(["p-3"]);
  });
});
