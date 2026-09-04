import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type ConsumptionAccess = {
  canRead: boolean;
  canManage: boolean;
};

export function getConsumptionAccess(user: UserLike): ConsumptionAccess {
  const permissions = user?.permissions || [];
  return {
    canRead: permissions.includes(PERMISSIONS.CONSUMPTION_READ),
    canManage: permissions.includes(PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE),
  };
}

export function getConsumptionDefaultRoute(access: ConsumptionAccess) {
  return access.canRead ? "/dashboard/consumption/points" : null;
}
