import type { AdminPermission } from "@hotel/shared";

export type PermissionViewFilters = {
  search: string;
};

export const DEFAULT_PERMISSION_VIEW_FILTERS: PermissionViewFilters = {
  search: ""
};

export function countAppliedPermissionFilters(filters: PermissionViewFilters): number {
  return filters.search.trim() ? 1 : 0;
}

export function applyPermissionViewFilters(permissions: AdminPermission[], filters: PermissionViewFilters): AdminPermission[] {
  const search = filters.search.trim().toLocaleLowerCase();

  if (!search) {
    return permissions;
  }

  return permissions.filter((permission) => permission.name.toLocaleLowerCase().includes(search));
}
