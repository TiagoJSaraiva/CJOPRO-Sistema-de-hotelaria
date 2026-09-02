import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getMaintenanceReferenceData } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { MaintenanceCatalogManager } from "../_components/MaintenanceCatalogManager";
import { getMaintenanceAccess } from "../access";
import { maintenanceTabs } from "../tabs";
import Link from "next/link";

export default async function MaintenanceSettingsPage() {
  const access = getMaintenanceAccess(await getUserFromSession());
  if (!access.canManageCatalogs && !access.canManageSla)
    return (
      <DashboardAccessDeniedCard
        title="Configuração de manutenção"
        message="Sem permissão para gerenciar catálogos."
      />
    );
  const data = await getMaintenanceReferenceData();
  return (
    <DashboardEntityPageShell
      title="Configuração de manutenção"
      activeTabKey="settings"
      tabs={maintenanceTabs(access)}
    >
      {access.canManageSla ? (
        <div className="mb-4">
          <Link
            href="/dashboard/maintenance/sla"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium no-underline"
          >
            Configurar SLA e precedência
          </Link>
        </div>
      ) : null}
      {access.canManageCatalogs ? (
        <MaintenanceCatalogManager
          initialCategories={data.categories}
          initialLocations={data.locations}
        />
      ) : null}
    </DashboardEntityPageShell>
  );
}
