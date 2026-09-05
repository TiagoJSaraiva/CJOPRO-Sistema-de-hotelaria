import { PERMISSIONS, type AuthUser } from "@hotel/shared";

export function getInventoryAccess(user: Pick<AuthUser, "permissions"> | null) {
  const permissions = user?.permissions || [];
  return {
    canRead: permissions.includes(PERMISSIONS.INVENTORY_READ),
    canReadCosts: permissions.includes(PERMISSIONS.INVENTORY_COSTS_READ),
    canManage: permissions.includes(PERMISSIONS.INVENTORY_SETTINGS_MANAGE),
    canPost: permissions.includes(PERMISSIONS.INVENTORY_MOVEMENTS_POST),
    canCount: permissions.includes(PERMISSIONS.INVENTORY_COUNTS_PERFORM),
  };
}
