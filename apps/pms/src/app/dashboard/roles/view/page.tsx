import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getRolesReferenceData, listRoles } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getRolesAccess, getRolesDefaultRoute } from "../access";
import { RoleStatusMessage } from "../_components/RoleStatusMessage";
import { RolesViewFilterableSection } from "../_components/RolesViewFilterableSection";

type RolesViewPageProps = {
  searchParams?: Promise<{
    status?: string;
    detail?: string;
    roleId?: string;
    mode?: string;
  }>;
};

export default async function RolesViewPage({
  searchParams,
}: RolesViewPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getRolesAccess(user);

  if (!access.canRead) {
    const fallback = getRolesDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <DashboardAccessDeniedCard
        title="Roles"
        message="Sem permissão para visualizar roles."
      />
    );
  }

  const [roles, referenceData] = await Promise.all([
    listRoles(),
    getRolesReferenceData().catch(() => ({ hotels: [], permissions: [] })),
  ]);

  const activeRoleId = String(resolvedSearchParams?.roleId || "").trim();
  const mode = resolvedSearchParams?.mode === "edit" ? "edit" : "view";
  const currentUserRoleIds = Array.from(
    new Set(
      (user?.roleAssignments || [])
        .map((assignment) => assignment.roleId)
        .filter(Boolean),
    ),
  );

  return (
    <DashboardEntityPageShell
      title="Roles"
      activeTabKey="view"
      tabs={[
        {
          key: "create",
          label: "Criar role",
          href: "/dashboard/roles/create",
          isVisible: access.canCreate,
        },
        {
          key: "view",
          label: "Ver roles",
          href: "/dashboard/roles/view",
          isVisible: access.canRead,
        },
      ]}
      statusContent={
        <RoleStatusMessage
          status={resolvedSearchParams?.status}
          detail={resolvedSearchParams?.detail}
        />
      }
    >
      <RolesViewFilterableSection
        roles={roles}
        hotels={referenceData.hotels}
        permissions={referenceData.permissions}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        currentUserRoleIds={currentUserRoleIds}
        activeRoleId={activeRoleId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
