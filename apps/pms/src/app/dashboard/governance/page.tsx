import { PERMISSIONS } from "@hotel/shared";
import {
  getConsumptionOperationalContext,
  getGovernanceBoard,
  getGovernanceTemplates,
} from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";
import { DashboardAccessDeniedCard } from "../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../_components/DashboardEntityPageShell";
import { getGovernanceAccess } from "./access";
import { GovernanceWorkspace } from "./GovernanceWorkspace";
import { governanceGuide } from "./usageGuide";

export default async function GovernancePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const user = await getUserFromSession();
  const access = getGovernanceAccess(user);
  if (!access.canRead)
    return (
      <DashboardAccessDeniedCard
        title="Governança"
        message="Sem permissão para consultar o giro dos quartos."
      />
    );
  const [board, templates] = await Promise.all([
    getGovernanceBoard(),
    access.canManageTemplates ? getGovernanceTemplates() : Promise.resolve([]),
  ]);
  const minibarContexts = access.canPostConsumption
    ? Object.fromEntries(
        await Promise.all(
          board.items
            .filter((cycle) => cycle.stay_id)
            .map(async (cycle) => [
              cycle.id,
              await getConsumptionOperationalContext(cycle.stay_id!).catch(
                () => null,
              ),
            ]),
        ),
      )
    : {};
  return (
    <DashboardEntityPageShell
      title="Governança"
      activeTabKey="board"
      tabs={[
        {
          key: "board",
          label: "Giro dos quartos",
          href: "/dashboard/governance",
          isVisible: true,
        },
        {
          key: "pending",
          label: "Pendências",
          href: "/dashboard/pending?source=governance",
          isVisible: user!.permissions.includes(PERMISSIONS.GOVERNANCE_READ),
        },
      ]}
      usageGuide={governanceGuide({
        ...access,
        hasMinibarOptions: board.minibar_options.length > 0,
        hasMaintenanceCategories: board.maintenance_categories.length > 0,
      })}
    >
      <GovernanceWorkspace
        initial={board}
        templates={templates}
        minibarContexts={minibarContexts}
        access={access}
        initialRoomId={(await searchParams)?.room_id || ""}
      />
    </DashboardEntityPageShell>
  );
}
