import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  getMaintenancePreventivePlans,
  getMaintenancePreventiveRuns,
  getMaintenanceReferenceData,
  getMaintenanceSuppliers,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getMaintenanceAccess } from "../access";
import { MaintenancePreventiveManager } from "../_components/MaintenancePreventiveManager";
import { maintenanceTabs } from "../tabs";
import { maintenancePreventiveGuide } from "../usageGuides";

export default async function MaintenancePreventivePage() {
  const access = getMaintenanceAccess(await getUserFromSession());
  if (!access.canManagePlans && !access.canExecute)
    return (
      <DashboardAccessDeniedCard
        title="Manutenção preventiva"
        message="Sem permissão para consultar planos preventivos."
      />
    );
  const [plans, references, suppliers] = await Promise.all([
    getMaintenancePreventivePlans(),
    getMaintenanceReferenceData(),
    access.canManageSuppliers || access.canReadAnalytics
      ? getMaintenanceSuppliers()
      : Promise.resolve([]),
  ]);
  const runs = (
    await Promise.all(
      plans.map((plan) => getMaintenancePreventiveRuns(plan.id)),
    )
  ).flat();
  return (
    <DashboardEntityPageShell
      title="Manutenção preventiva"
      activeTabKey="preventive"
      tabs={maintenanceTabs(access)}
      usageGuide={maintenancePreventiveGuide}
    >
      <MaintenancePreventiveManager
        plans={plans}
        runs={runs}
        references={references}
        suppliers={suppliers}
        canManage={access.canManagePlans}
      />
    </DashboardEntityPageShell>
  );
}
