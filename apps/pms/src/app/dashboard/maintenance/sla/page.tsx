import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  getMaintenanceReferenceData,
  getMaintenanceSlaPolicies,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getMaintenanceAccess } from "../access";
import { MaintenanceSlaManager } from "../_components/MaintenanceSlaManager";
import { maintenanceTabs } from "../tabs";

export default async function MaintenanceSlaPage() {
  const access = getMaintenanceAccess(await getUserFromSession());
  if (!access.canManageSla && !access.canReadAnalytics)
    return (
      <DashboardAccessDeniedCard
        title="SLA de manutenção"
        message="Sem permissão para consultar políticas de SLA."
      />
    );
  const [policies, references] = await Promise.all([
    getMaintenanceSlaPolicies(),
    getMaintenanceReferenceData(),
  ]);
  return (
    <DashboardEntityPageShell
      title="SLA de manutenção"
      activeTabKey="settings"
      tabs={maintenanceTabs(access)}
    >
      <MaintenanceSlaManager
        policies={policies}
        categories={references.categories}
        canManage={access.canManageSla}
      />
    </DashboardEntityPageShell>
  );
}
