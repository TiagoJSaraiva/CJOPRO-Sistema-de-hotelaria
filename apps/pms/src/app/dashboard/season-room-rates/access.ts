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
