export const PERMISSIONS = {
  HOTEL_CREATE: "create_hotel",
  HOTEL_READ: "read_hotel",
  HOTEL_UPDATE: "update_hotel",
  HOTEL_DELETE: "delete_hotel",
  USER_CREATE: "create_user",
  USER_READ: "read_user",
  USER_UPDATE: "update_user",
  USER_DELETE: "delete_user",
  ROLE_CREATE: "create_role",
  ROLE_READ: "read_role",
  ROLE_UPDATE: "update_role",
  ROLE_DELETE: "delete_role",
  PERMISSION_CREATE: "create_permission",
  PERMISSION_READ: "read_permission",
  PERMISSION_UPDATE: "update_permission",
  PERMISSION_DELETE: "delete_permission"
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ADMIN_NAV_ITEMS = [
  {
    href: "/dashboard/hotels",
    label: "Hoteis",
    permission: PERMISSIONS.HOTEL_READ
  },
  {
    href: "/dashboard/users",
    label: "Usuarios",
    permission: PERMISSIONS.USER_READ
  },
  {
    href: "/dashboard/roles",
    label: "Roles",
    permission: PERMISSIONS.ROLE_READ
  },
  {
    href: "/dashboard/permissions",
    label: "Permissoes",
    permission: PERMISSIONS.PERMISSION_READ
  }
] as const;
