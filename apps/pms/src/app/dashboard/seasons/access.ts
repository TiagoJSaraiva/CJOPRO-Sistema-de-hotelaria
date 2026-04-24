import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type SeasonsAccess = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function getSeasonsAccess(user: UserLike): SeasonsAccess {
  const permissions = user?.permissions || [];
  return {
    canCreate: permissions.includes(PERMISSIONS.SEASON_CREATE),
    canRead: permissions.includes(PERMISSIONS.SEASON_READ),
    canUpdate: permissions.includes(PERMISSIONS.SEASON_UPDATE),
    canDelete: permissions.includes(PERMISSIONS.SEASON_DELETE)
  };
}
