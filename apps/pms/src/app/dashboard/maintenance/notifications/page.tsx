import Link from "next/link";
import { OPERATIONAL_PENDING_PERMISSIONS } from "@hotel/shared";
import { getOperationalPending } from "../../../../lib/adminApi";
import { PendingCards } from "../../pending/PendingWorkspace";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getMaintenanceNotifications } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getMaintenanceAccess } from "../access";
import { MaintenanceNotificationInbox } from "../_components/MaintenanceNotificationInbox";
import { maintenanceTabs } from "../tabs";
import { maintenanceNotificationsGuide } from "../usageGuides";

export default async function MaintenanceNotificationsPage() {
  const user = await getUserFromSession();
  const access = getMaintenanceAccess(user);
  const pending =
    user &&
    OPERATIONAL_PENDING_PERMISSIONS.some((permission) =>
      user.permissions.includes(permission),
    )
      ? await getOperationalPending("source=maintenance")
      : null;
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
      usageGuide={maintenanceNotificationsGuide}
    >
      {pending && (
        <>
          <PendingCards data={pending} source="maintenance" />
          <Link
            className="pms-link"
            href="/dashboard/pending?source=maintenance"
          >
            Tratar pendências de manutenção
          </Link>
        </>
      )}
      <p>
        Caixa histórica: dispensar uma notificação não resolve a condição
        operacional.
      </p>
      <MaintenanceNotificationInbox
        initialItems={await getMaintenanceNotifications()}
      />
    </DashboardEntityPageShell>
  );
}
