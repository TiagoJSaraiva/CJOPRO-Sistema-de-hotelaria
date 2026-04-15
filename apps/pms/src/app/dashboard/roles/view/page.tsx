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
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Roles</h2>
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

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <section>
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem" }}>Roles</h1>
        <RoleStatusMessage status={searchParams?.status} detail={searchParams?.detail} />
      </section>

      <RolesViewFilterableSection
        roles={roles}
        hotels={referenceData.hotels}
        permissions={referenceData.permissions}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
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
