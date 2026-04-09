import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { listPermissions } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getPermissionsAccess, getPermissionsDefaultRoute } from "../access";
import { PermissionListItem } from "../_components/PermissionListItem";
import { PermissionStatusMessage } from "../_components/PermissionStatusMessage";

type PermissionsViewPageProps = {
  searchParams?: {
    status?: string;
    permissionId?: string;
    mode?: string;
  };
};

export default async function PermissionsViewPage({ searchParams }: PermissionsViewPageProps) {
  const user = await getUserFromSession();
  const access = getPermissionsAccess(user);

  if (!access.canRead) {
    const fallback = getPermissionsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Permissoes</h2>
        <p>Sem permissao para visualizar permissoes.</p>
      </section>
    );
  }

  const permissions = await listPermissions();
  const activePermissionId = String(searchParams?.permissionId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <section>
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem" }}>Permissoes</h1>
        <PermissionTabs
          activeKey="view"
          items={[
            { key: "create", label: "Criar permissao", href: "/dashboard/permissions/create", isVisible: access.canCreate },
            { key: "view", label: "Ver permissoes", href: "/dashboard/permissions/view", isVisible: access.canRead }
          ]}
        />
        <PermissionStatusMessage status={searchParams?.status} />
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        {permissions.length ? (
          permissions.map((item) => (
            <PermissionListItem
              key={item.id}
              permissionItem={item}
              canRead={access.canRead}
              canUpdate={access.canUpdate}
              canDelete={access.canDelete}
              isViewing={activePermissionId === item.id && mode === "view"}
              isEditing={activePermissionId === item.id && mode === "edit"}
            />
          ))
        ) : (
          <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem", color: "#666" }}>
            Nenhuma permissao cadastrada ate o momento.
          </article>
        )}
      </section>
    </section>
  );
}
