import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getUserFromSession } from "../../../../lib/auth";
import { getPermissionsAccess, getPermissionsDefaultRoute } from "../access";
import { PermissionCreateForm } from "../_components/PermissionCreateForm";
import { PermissionStatusMessage } from "../_components/PermissionStatusMessage";

type PermissionsCreatePageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function PermissionsCreatePage({ searchParams }: PermissionsCreatePageProps) {
  const user = await getUserFromSession();
  const access = getPermissionsAccess(user);

  if (!access.canCreate) {
    const fallback = getPermissionsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Permissoes</h2>
        <p>Sem permissao para criar permissao.</p>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <section>
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem" }}>Permissoes</h1>
        <PermissionTabs
          activeKey="create"
          items={[
            { key: "create", label: "Criar permissao", href: "/dashboard/permissions/create", isVisible: access.canCreate },
            { key: "view", label: "Ver permissoes", href: "/dashboard/permissions/view", isVisible: access.canRead }
          ]}
        />
        <PermissionStatusMessage status={searchParams?.status} />
      </section>

      <PermissionCreateForm />
    </section>
  );
}
