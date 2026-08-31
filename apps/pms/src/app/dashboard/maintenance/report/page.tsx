import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getMaintenanceReferenceData } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { MaintenanceReportForm } from "../_components/MaintenanceReportForm";
import { getMaintenanceAccess } from "../access";

export default async function MaintenanceReportPage() {
  const access = getMaintenanceAccess(await getUserFromSession());
  if (!access.canCreate) return <DashboardAccessDeniedCard title="Registrar ocorrência" message="Sem permissão para registrar ocorrências." />;
  const referenceData = await getMaintenanceReferenceData();
  return <DashboardEntityPageShell title="Registrar ocorrência" activeTabKey="report" tabs={[{ key: "all", label: "Todas", href: "/dashboard/maintenance/view", isVisible: access.canRead }, { key: "report", label: "Registrar", href: "/dashboard/maintenance/report", isVisible: access.canCreate }, { key: "settings", label: "Configuração", href: "/dashboard/maintenance/settings", isVisible: access.canManageCatalogs }]}><MaintenanceReportForm referenceData={referenceData} /></DashboardEntityPageShell>;
}
