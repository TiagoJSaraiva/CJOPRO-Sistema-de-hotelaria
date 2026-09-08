import { OPERATIONAL_PENDING_PERMISSIONS } from "@hotel/shared";
import { getUserFromSession } from "../../../lib/auth";
import { getOperationalPending } from "../../../lib/adminApi";
import { DashboardAccessDeniedCard } from "../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../_components/DashboardEntityPageShell";
import { PendingWorkspace } from "./PendingWorkspace";
import { pendingGuide } from "./usageGuide";
export default async function PendingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string>>;
}) {
  const user = await getUserFromSession();
  if (
    !user ||
    !OPERATIONAL_PENDING_PERMISSIONS.some((permission) =>
      user.permissions.includes(permission),
    )
  )
    return (
      <DashboardAccessDeniedCard
        title="Pendências"
        message="Sem permissão para consultar pendências."
      />
    );
  const params = (await searchParams) || {};
  const query = new URLSearchParams();
  for (const key of [
    "page",
    "source",
    "kind",
    "severity",
    "status",
    "assignee",
    "read",
  ])
    if (params[key]) query.set(key, params[key]);
  const initial = await getOperationalPending(query.toString());
  return (
    <DashboardEntityPageShell
      title="Pendências"
      activeTabKey="pending"
      tabs={[
        {
          key: "pending",
          label: "Pendências",
          href: "/dashboard/pending",
          isVisible: true,
        },
      ]}
      usageGuide={pendingGuide}
    >
      <PendingWorkspace
        initial={initial}
        userId={user.id}
        initialQuery={query.toString()}
      />
    </DashboardEntityPageShell>
  );
}
