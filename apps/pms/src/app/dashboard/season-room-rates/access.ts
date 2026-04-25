import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type SeasonRoomRatesAccess = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function getSeasonRoomRatesAccess(user: UserLike): SeasonRoomRatesAccess {
  const permissions = user?.permissions || [];
  return {
    canCreate: permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_CREATE),
    canRead: permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_READ),
    canUpdate: permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_UPDATE),
    canDelete: permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_DELETE)
  };
}

export function getSeasonRoomRatesDefaultRoute(
  access: SeasonRoomRatesAccess
): "/dashboard/season-room-rates/view" | "/dashboard/season-room-rates/create" | null {
  if (access.canRead) {
    return "/dashboard/season-room-rates/view";
  }

  if (access.canCreate) {
    return "/dashboard/season-room-rates/create";
  }

  return null;
}
