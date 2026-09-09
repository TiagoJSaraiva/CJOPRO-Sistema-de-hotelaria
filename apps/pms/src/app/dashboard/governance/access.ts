import { PERMISSIONS, type AuthUser } from "@hotel/shared";

export function getGovernanceAccess(
  user: Pick<AuthUser, "permissions"> | null,
) {
  const permissions = user?.permissions || [];
  return {
    canRead: permissions.includes(PERMISSIONS.GOVERNANCE_READ),
    canExecute: permissions.includes(PERMISSIONS.GOVERNANCE_EXECUTE),
    canInspect: permissions.includes(PERMISSIONS.GOVERNANCE_INSPECT),
    canAssign: permissions.includes(PERMISSIONS.GOVERNANCE_ASSIGN),
    canManageTemplates: permissions.includes(
      PERMISSIONS.GOVERNANCE_TEMPLATES_MANAGE,
    ),
    canPostConsumption: permissions.includes(PERMISSIONS.CONSUMPTION_POST),
    canReceivePayment: permissions.includes(
      PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE,
    ),
    canGrantCourtesy: permissions.includes(
      PERMISSIONS.CONSUMPTION_COURTESY_GRANT,
    ),
    canReportMaintenance: permissions.includes(
      PERMISSIONS.MAINTENANCE_OCCURRENCE_CREATE,
    ),
  };
}
