import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getRolesReferenceData, listRoles } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getRolesAccess, getRolesDefaultRoute } from "../access";
import { RoleStatusMessage } from "../_components/RoleStatusMessage";
import { RolesViewFilterableSection } from "../_components/RolesViewFilterableSection";

type RolesViewPageProps = {
  searchParams?: {
    status?: string;
    detail?: string;
    roleId?: string;
    mode?: string;
  };
};

export default async function RolesViewPage({ searchParams }: RolesViewPageProps) {
  const user = await getUserFromSession();
  const access = getRolesAccess(user);

  if (!access.canRead) {
    const fallback = getRolesDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Roles</h2>
        <p>Sem permissao para visualizar roles.</p>
      </section>
    );
  }

  const [roles, referenceData] = await Promise.all([
    listRoles(),
    getRolesReferenceData().catch(() => ({ hotels: [], permissions: [] }))
  ]);

  const activeRoleId = String(searchParams?.roleId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";
  const currentUserRoleIds = Array.from(new Set((user?.roleAssignments || []).map((assignment) => assignment.roleId).filter(Boolean)));

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Roles</h1>
        <RoleStatusMessage status={searchParams?.status} detail={searchParams?.detail} />
      </section>

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
      >
        <PermissionTabs
          activeKey="view"
          items={[
            { key: "create", label: "Criar role", href: "/dashboard/roles/create", isVisible: access.canCreate },
            { key: "view", label: "Ver roles", href: "/dashboard/roles/view", isVisible: access.canRead }
          ]}
        />
      </RolesViewFilterableSection>
    </section>
  );
}
