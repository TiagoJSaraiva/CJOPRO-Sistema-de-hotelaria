import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type ReservationsCalendarAccess = {
  canAccess: boolean;
};

export function getReservationsCalendarAccess(
  user: UserLike,
): ReservationsCalendarAccess {
  const permissions = user?.permissions || [];
  return {
    canAccess: permissions.includes(PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS),
  };
}

export function getReservationsCalendarDefaultRoute(
  access: ReservationsCalendarAccess,
): "/dashboard/reservations/view" | null {
  if (access.canAccess) {
    return "/dashboard/reservations/view";
  }

  return null;
}
