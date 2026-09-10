import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getMaintenancePlanningBoard } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { MaintenancePlanningWorkspace } from "../_components/MaintenancePlanningWorkspace";
import { getMaintenanceAccess } from "../access";
import { maintenanceTabs } from "../tabs";
import { maintenanceAgendaGuide } from "../usageGuides";

export default async function MaintenanceAgendaPage() {
  const user = await getUserFromSession();
  const access = getMaintenanceAccess(user);
  if (!access.canExecute && !access.canManageSchedule)
    return (
      <DashboardAccessDeniedCard
        title="Planejamento"
        message="Sem permissão para consultar a agenda de manutenção."
      />
    );
  const board = await getMaintenancePlanningBoard();
  return (
    <DashboardEntityPageShell
      title="Planejamento de manutenção"
      activeTabKey="agenda"
      tabs={maintenanceTabs(access)}
      usageGuide={maintenanceAgendaGuide}
    >
      <MaintenancePlanningWorkspace
        initial={board}
        viewerId={user?.id || ""}
        access={access}
      />
    </DashboardEntityPageShell>
  );
}
