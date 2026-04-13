import type { AdminRole } from "@hotel/shared";

export type RoleViewFilters = {
  search: string;
  hotelId: string;
  permissionId: string;
};

export const DEFAULT_ROLE_VIEW_FILTERS: RoleViewFilters = {
  search: "",
  hotelId: "",
  permissionId: ""
};

export function countAppliedRoleFilters(filters: RoleViewFilters): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.hotelId.trim()) total += 1;
  if (filters.permissionId.trim()) total += 1;

  return total;
}

export function applyRoleViewFilters(roles: AdminRole[], filters: RoleViewFilters): AdminRole[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const hotelId = filters.hotelId.trim();
  const permissionId = filters.permissionId.trim();

  return roles.filter((role) => {
    if (search && !role.name.toLocaleLowerCase().includes(search)) {
      return false;
    }

    if (hotelId && role.hotel_id !== hotelId) {
      return false;
    }

    if (permissionId) {
      const matchesPermission = role.permissions.some((permission) => permission.id === permissionId);

      if (!matchesPermission) {
        return false;
      }
    }

    return true;
  });
}
