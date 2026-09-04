import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type ConsumptionAccess = {
  canRead: boolean;
  canManage: boolean;
  canReadCommercial: boolean;
  canManagePartners: boolean;
  canManageAgreements: boolean;
  canPost: boolean;
  canReceivePayment: boolean;
  canGrantCourtesy: boolean;
  canVoid: boolean;
  canApproveAdjustments: boolean;
};

export function getConsumptionAccess(user: UserLike): ConsumptionAccess {
  const permissions = user?.permissions || [];
  return {
    canRead: permissions.includes(PERMISSIONS.CONSUMPTION_READ),
    canManage: permissions.includes(PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE),
    canReadCommercial: permissions.includes(
      PERMISSIONS.COMMERCIAL_PARTNERS_READ,
    ),
    canManagePartners: permissions.includes(
      PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE,
    ),
    canManageAgreements: permissions.includes(
      PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
    ),
    canPost: permissions.includes(PERMISSIONS.CONSUMPTION_POST),
    canReceivePayment: permissions.includes(
      PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE,
    ),
    canGrantCourtesy: permissions.includes(
      PERMISSIONS.CONSUMPTION_COURTESY_GRANT,
    ),
    canVoid: permissions.includes(PERMISSIONS.CONSUMPTION_VOID),
    canApproveAdjustments: permissions.includes(
      PERMISSIONS.CONSUMPTION_ADJUSTMENT_APPROVE,
    ),
  };
}

export function getConsumptionDefaultRoute(access: ConsumptionAccess) {
  if (access.canPost) return "/dashboard/consumption/launch";
  if (access.canRead) return "/dashboard/consumption/points";
  return access.canReadCommercial ? "/dashboard/consumption/partners" : null;
}
