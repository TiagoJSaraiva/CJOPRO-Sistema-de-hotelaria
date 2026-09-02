import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getMaintenanceNotifications } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getMaintenanceAccess } from "../access";
import { MaintenanceNotificationInbox } from "../_components/MaintenanceNotificationInbox";
import { maintenanceTabs } from "../tabs";

export default async function MaintenanceNotificationsPage() {
  const access = getMaintenanceAccess(await getUserFromSession());
  if (!access.canEnter)
    return (
      <DashboardAccessDeniedCard
        title="Alertas de manutenção"
        message="Sem acesso ao módulo de manutenção."
      />
    );
  return (
    <DashboardEntityPageShell
      title="Alertas de manutenção"
      activeTabKey="notifications"
      tabs={maintenanceTabs(access)}
    >
      <MaintenanceNotificationInbox
        initialItems={await getMaintenanceNotifications()}
      />
    </DashboardEntityPageShell>
  );
}
