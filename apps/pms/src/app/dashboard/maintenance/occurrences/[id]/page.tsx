import { DashboardAccessDeniedCard } from "../../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../../_components/DashboardEntityPageShell";
import {
  getMaintenanceOccurrence,
  getMaintenanceOccurrenceFinance,
  getMaintenanceReferenceData,
  getMaintenanceSuppliers,
} from "../../../../../lib/adminApi";
import { getUserFromSession } from "../../../../../lib/auth";
import { MaintenanceOccurrenceWorkspace } from "../../_components/MaintenanceOccurrenceWorkspace";
import { MaintenanceOccurrenceFinancePanel } from "../../_components/MaintenanceOccurrenceFinancePanel";
import { getMaintenanceAccess } from "../../access";
import { maintenanceTabs } from "../../tabs";
import { maintenanceOccurrenceGuide } from "../../usageGuides";

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
  const [item, referenceData, finance, suppliers] = await Promise.all([
    getMaintenanceOccurrence(id),
    getMaintenanceReferenceData(),
    access.canReadFinance
      ? getMaintenanceOccurrenceFinance(id)
      : Promise.resolve(null),
    access.canManageSuppliers || access.canReadFinance
      ? getMaintenanceSuppliers()
      : Promise.resolve([]),
  ]);
  return (
    <DashboardEntityPageShell
      title={`Ocorrência ${item.code}`}
      activeTabKey="detail"
      tabs={maintenanceTabs(access)}
      usageGuide={maintenanceOccurrenceGuide}
    >
      <MaintenanceOccurrenceWorkspace
        initial={item}
        referenceData={referenceData}
        access={access}
        suppliers={suppliers}
      />
      {finance ? (
        <div className="mt-4">
          <MaintenanceOccurrenceFinancePanel
            occurrenceId={item.id}
            stayId={item.stay_id}
            initial={finance}
            canPropose={access.canProposeFinance}
            suppliers={suppliers}
          />
        </div>
      ) : null}
    </DashboardEntityPageShell>
  );
}
