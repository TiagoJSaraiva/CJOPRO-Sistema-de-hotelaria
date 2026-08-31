import { DashboardAccessDeniedCard } from "../../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../../_components/DashboardEntityPageShell";
import { getMaintenanceOccurrence, getMaintenanceReferenceData } from "../../../../../lib/adminApi";
import { getUserFromSession } from "../../../../../lib/auth";
import { MaintenanceOccurrenceWorkspace } from "../../_components/MaintenanceOccurrenceWorkspace";
import { getMaintenanceAccess } from "../../access";

type Props = { params: Promise<{ id: string }> };
export default async function MaintenanceOccurrencePage({ params }: Props) {
  const access = getMaintenanceAccess(await getUserFromSession());
  if (!access.canEnter) return <DashboardAccessDeniedCard title="Ocorrência" message="Sem permissão para acessar manutenção." />;
  const { id } = await params;
  const [item, referenceData] = await Promise.all([getMaintenanceOccurrence(id), getMaintenanceReferenceData()]);
  return <DashboardEntityPageShell title={`Ocorrência ${item.code}`} activeTabKey="detail" tabs={[{ key: "all", label: "Todas", href: "/dashboard/maintenance/view", isVisible: access.canRead }, { key: "report", label: "Registrar", href: "/dashboard/maintenance/report", isVisible: access.canCreate }, { key: "settings", label: "Configuração", href: "/dashboard/maintenance/settings", isVisible: access.canManageCatalogs }]}><MaintenanceOccurrenceWorkspace initial={item} referenceData={referenceData} access={access} /></DashboardEntityPageShell>;
}
