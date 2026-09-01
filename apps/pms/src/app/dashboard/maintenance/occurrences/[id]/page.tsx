import { DashboardAccessDeniedCard } from "../../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../../_components/DashboardEntityPageShell";
import {
  getMaintenanceOccurrence,
  getMaintenanceOccurrenceFinance,
  getMaintenanceReferenceData,
} from "../../../../../lib/adminApi";
import { getUserFromSession } from "../../../../../lib/auth";
import { MaintenanceOccurrenceWorkspace } from "../../_components/MaintenanceOccurrenceWorkspace";
import { MaintenanceOccurrenceFinancePanel } from "../../_components/MaintenanceOccurrenceFinancePanel";
import { getMaintenanceAccess } from "../../access";

type Props = { params: Promise<{ id: string }> };
export default async function MaintenanceOccurrencePage({ params }: Props) {
  const user = await getUserFromSession();
  const access = getMaintenanceAccess(user);
  if (!access.canEnter)
    return (
      <DashboardAccessDeniedCard
        title="Ocorrência"
        message="Sem permissão para acessar manutenção."
      />
    );
  const { id } = await params;
  const [item, referenceData, finance] = await Promise.all([
    getMaintenanceOccurrence(id),
    getMaintenanceReferenceData(),
    access.canReadFinance
      ? getMaintenanceOccurrenceFinance(id)
      : Promise.resolve(null),
  ]);
  return (
    <DashboardEntityPageShell
      title={`Ocorrência ${item.code}`}
      activeTabKey="detail"
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
      <MaintenanceOccurrenceWorkspace
        initial={item}
        referenceData={referenceData}
        access={access}
      />
      {finance ? (
        <div className="mt-4">
          <MaintenanceOccurrenceFinancePanel
            occurrenceId={item.id}
            stayId={item.stay_id}
            initial={finance}
            canPropose={access.canProposeFinance}
          />
        </div>
      ) : null}
    </DashboardEntityPageShell>
  );
}
