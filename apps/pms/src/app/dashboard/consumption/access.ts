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
  canReadAnalytics: boolean;
  canReadSettlements: boolean;
  canPrepareSettlements: boolean;
  canApproveSettlements: boolean;
  canSettleSettlements: boolean;
  canManagePartnerDisputes?: boolean;
  canManageService: boolean;
  canCancelService: boolean;
  canManagePayers: boolean;
  canManageCorporate: boolean;
  canRequestCorporateCredit: boolean;
  canApproveCorporateCredit: boolean;
  canSettleCorporateReceivables: boolean;
  canManageBenefits: boolean;
  canOverrideBenefits: boolean;
  canTransferConsumption: boolean;
  canReviewPostCheckout: boolean;
  canWaivePostCheckout: boolean;
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
    canReadAnalytics: permissions.includes(
      PERMISSIONS.CONSUMPTION_ANALYTICS_READ,
    ),
    canReadSettlements: permissions.includes(
      PERMISSIONS.PARTNER_SETTLEMENTS_READ,
    ),
    canPrepareSettlements: permissions.includes(
      PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE,
    ),
    canApproveSettlements: permissions.includes(
      PERMISSIONS.PARTNER_SETTLEMENTS_APPROVE,
    ),
    canSettleSettlements: permissions.includes(
      PERMISSIONS.PARTNER_SETTLEMENTS_SETTLE,
    ),
    canManagePartnerDisputes: permissions.includes(
      PERMISSIONS.PARTNER_DISPUTES_MANAGE,
    ),
    canManageService: permissions.includes(
      PERMISSIONS.CONSUMPTION_SERVICE_MANAGE,
    ),
    canCancelService: permissions.includes(
      PERMISSIONS.CONSUMPTION_SERVICE_CANCEL,
    ),
    canManagePayers: permissions.includes(PERMISSIONS.STAY_PAYERS_MANAGE),
    canManageCorporate: permissions.includes(
      PERMISSIONS.CORPORATE_ACCOUNTS_MANAGE,
    ),
    canRequestCorporateCredit: permissions.includes(
      PERMISSIONS.CORPORATE_CREDIT_REQUEST,
    ),
    canApproveCorporateCredit: permissions.includes(
      PERMISSIONS.CORPORATE_CREDIT_APPROVE,
    ),
    canSettleCorporateReceivables: permissions.includes(
      PERMISSIONS.CORPORATE_RECEIVABLES_SETTLE,
    ),
    canManageBenefits: permissions.includes(
      PERMISSIONS.CONSUMPTION_BENEFITS_MANAGE,
    ),
    canOverrideBenefits: permissions.includes(
      PERMISSIONS.CONSUMPTION_BENEFITS_OVERRIDE,
    ),
    canTransferConsumption: permissions.includes(
      PERMISSIONS.CONSUMPTION_TRANSFER,
    ),
    canReviewPostCheckout: permissions.includes(
      PERMISSIONS.POST_CHECKOUT_CONSUMPTION_REVIEW,
    ),
    canWaivePostCheckout: permissions.includes(
      PERMISSIONS.POST_CHECKOUT_CONSUMPTION_WAIVE,
    ),
  };
}

export function getConsumptionDefaultRoute(access: ConsumptionAccess) {
  if (access.canManageService) return "/dashboard/consumption/service";
  if (access.canPost) return "/dashboard/consumption/launch";
  if (access.canReadAnalytics) return "/dashboard/consumption/analytics";
  if (
    access.canReadSettlements ||
    access.canPrepareSettlements ||
    access.canApproveSettlements ||
    access.canSettleSettlements
  )
    return "/dashboard/consumption/settlements";
  if (access.canRead) return "/dashboard/consumption/points";
  return access.canReadCommercial ? "/dashboard/consumption/partners" : null;
}
