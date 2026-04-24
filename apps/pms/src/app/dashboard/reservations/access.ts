import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type ReservationsAccess = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function getReservationsAccess(user: UserLike): ReservationsAccess {
  const permissions = user?.permissions || [];
  return {
    canCreate: permissions.includes(PERMISSIONS.RESERVATION_CREATE),
    canRead: permissions.includes(PERMISSIONS.RESERVATION_READ),
    canUpdate: permissions.includes(PERMISSIONS.RESERVATION_UPDATE),
    canDelete: permissions.includes(PERMISSIONS.RESERVATION_DELETE)
  };
}
