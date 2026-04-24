export const PERMISSIONS = {
  HOTEL_CREATE: "create_hotel",
  HOTEL_READ: "read_hotel",
  HOTEL_UPDATE: "update_hotel",
  HOTEL_DELETE: "delete_hotel",
  ROOM_CREATE: "create_room",
  ROOM_READ: "read_room",
  ROOM_UPDATE: "update_room",
  ROOM_DELETE: "delete_room",
  CUSTOMER_CREATE: "create_customer",
  CUSTOMER_READ: "read_customer",
  CUSTOMER_UPDATE: "update_customer",
  CUSTOMER_DELETE: "delete_customer",
  RESERVATION_CREATE: "create_reservation",
  RESERVATION_READ: "read_reservation",
  RESERVATION_UPDATE: "update_reservation",
  RESERVATION_DELETE: "delete_reservation",
  PRODUCT_CREATE: "create_product",
  PRODUCT_READ: "read_product",
  PRODUCT_UPDATE: "update_product",
  PRODUCT_DELETE: "delete_product",
  SEASON_CREATE: "create_season",
  SEASON_READ: "read_season",
  SEASON_UPDATE: "update_season",
  SEASON_DELETE: "delete_season",
  SEASON_ROOM_RATE_CREATE: "create_season_room_rate",
  SEASON_ROOM_RATE_READ: "read_season_room_rate",
  SEASON_ROOM_RATE_UPDATE: "update_season_room_rate",
  SEASON_ROOM_RATE_DELETE: "delete_season_room_rate",
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
    href: "/dashboard/rooms",
    label: "Quartos",
    permission: PERMISSIONS.ROOM_READ
  },
  {
    href: "/dashboard/customers",
    label: "Clientes",
    permission: PERMISSIONS.CUSTOMER_READ
  },
  {
    href: "/dashboard/reservations",
    label: "Reservas",
    permission: PERMISSIONS.RESERVATION_READ
  },
  {
    href: "/dashboard/products",
    label: "Produtos",
    permission: PERMISSIONS.PRODUCT_READ
  },
  {
    href: "/dashboard/seasons",
    label: "Temporadas",
    permission: PERMISSIONS.SEASON_READ
  },
  {
    href: "/dashboard/season-room-rates",
    label: "Tarifas por Temporada",
    permission: PERMISSIONS.SEASON_ROOM_RATE_READ
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
