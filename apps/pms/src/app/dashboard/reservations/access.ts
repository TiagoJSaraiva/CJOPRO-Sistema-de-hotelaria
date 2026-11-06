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

export type StayAccountAccess = {
  canRead: boolean;
  canOperate: boolean;
};

/** O financeiro confere a conta; operar a estadia exige o calendário. */
export function getStayAccountAccess(user: UserLike): StayAccountAccess {
  const permissions = user?.permissions || [];
  const canOperate = permissions.includes(
    PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
  );
  return {
    canOperate,
    canRead: canOperate || permissions.includes(PERMISSIONS.TRANSACTION_READ),
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
