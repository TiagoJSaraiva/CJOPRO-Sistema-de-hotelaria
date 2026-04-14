import type { AdminPermission } from "@hotel/shared";

export type PermissionViewFilters = {
  search: string;
  type: "" | "SYSTEM_PERMISSION" | "HOTEL_PERMISSION";
};

export const DEFAULT_PERMISSION_VIEW_FILTERS: PermissionViewFilters = {
  search: "",
  type: ""
};

export function countAppliedPermissionFilters(filters: PermissionViewFilters): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.type) total += 1;

  return total;
}

export function applyPermissionViewFilters(permissions: AdminPermission[], filters: PermissionViewFilters): AdminPermission[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const type = filters.type;

  return permissions.filter((permission) => {
    if (search && !permission.name.toLocaleLowerCase().includes(search)) {
      return false;
    }

    if (type && permission.type !== type) {
      return false;
    }

    return true;
  });
}
