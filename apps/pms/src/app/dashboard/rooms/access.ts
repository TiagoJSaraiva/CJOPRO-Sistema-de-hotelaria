import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type RoomsAccess = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function getRoomsAccess(user: UserLike): RoomsAccess {
  const permissions = user?.permissions || [];

  return {
    canCreate: permissions.includes(PERMISSIONS.ROOM_CREATE),
    canRead: permissions.includes(PERMISSIONS.ROOM_READ),
    canUpdate: permissions.includes(PERMISSIONS.ROOM_UPDATE),
    canDelete: permissions.includes(PERMISSIONS.ROOM_DELETE)
  };
}
