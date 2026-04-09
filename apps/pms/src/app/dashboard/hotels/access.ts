import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type HotelAccess = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function getHotelAccess(user: UserLike): HotelAccess {
  const permissions = user?.permissions || [];

  return {
    canCreate: permissions.includes(PERMISSIONS.HOTEL_CREATE),
    canRead: permissions.includes(PERMISSIONS.HOTEL_READ),
    canUpdate: permissions.includes(PERMISSIONS.HOTEL_UPDATE),
    canDelete: permissions.includes(PERMISSIONS.HOTEL_DELETE)
  };
}

export function getHotelDefaultRoute(access: HotelAccess): "/dashboard/hotels/view" | "/dashboard/hotels/create" | null {
  if (access.canRead) {
    return "/dashboard/hotels/view";
  }

  if (access.canCreate) {
    return "/dashboard/hotels/create";
  }

  return null;
}
