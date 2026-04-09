import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getRolesReferenceData } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getRolesAccess, getRolesDefaultRoute } from "../access";
import { RoleCreateForm } from "../_components/RoleCreateForm";
import { RoleStatusMessage } from "../_components/RoleStatusMessage";

type RolesCreatePageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function RolesCreatePage({ searchParams }: RolesCreatePageProps) {
  const user = await getUserFromSession();
  const access = getRolesAccess(user);

  if (!access.canCreate) {
    const fallback = getRolesDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Roles</h2>
        <p>Sem permissao para criar role.</p>
      </section>
    );
  }

  const referenceData = await getRolesReferenceData().catch(() => ({ hotels: [], permissions: [] }));

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <section>
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem" }}>Roles</h1>
        <PermissionTabs
          activeKey="create"
          items={[
            { key: "create", label: "Criar role", href: "/dashboard/roles/create", isVisible: access.canCreate },
            { key: "view", label: "Ver roles", href: "/dashboard/roles/view", isVisible: access.canRead }
          ]}
        />
        <RoleStatusMessage status={searchParams?.status} />
      </section>

      <RoleCreateForm hotels={referenceData.hotels} permissions={referenceData.permissions} />
    </section>
  );
}
