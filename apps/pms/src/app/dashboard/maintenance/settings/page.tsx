import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getMaintenanceReferenceData } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { MaintenanceCatalogManager } from "../_components/MaintenanceCatalogManager";
import { getMaintenanceAccess } from "../access";

export default async function MaintenanceSettingsPage() {
  const access = getMaintenanceAccess(await getUserFromSession());
  if (!access.canManageCatalogs)
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
      tabs={[
        {
          key: "all",
          label: "Todas",
          href: "/dashboard/maintenance/view",
          isVisible: access.canRead,
        },
        {
          key: "report",
          label: "Registrar",
          href: "/dashboard/maintenance/report",
          isVisible: access.canCreate,
        },
        {
          key: "finance",
          label: "Financeiro",
          href: "/dashboard/maintenance/finance",
          isVisible: access.canReadFinance,
        },
        {
          key: "settings",
          label: "Configuração",
          href: "/dashboard/maintenance/settings",
          isVisible: access.canManageCatalogs,
        },
      ]}
    >
      <MaintenanceCatalogManager
        initialCategories={data.categories}
        initialLocations={data.locations}
      />
    </DashboardEntityPageShell>
  );
}
