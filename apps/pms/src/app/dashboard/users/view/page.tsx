import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getUsersReferenceData, listUsers } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getUsersAccess, getUsersDefaultRoute } from "../access";
import { UserListItem } from "../_components/UserListItem";
import { UserStatusMessage } from "../_components/UserStatusMessage";

type UsersViewPageProps = {
  searchParams?: {
    status?: string;
    userId?: string;
    mode?: string;
  };
};

export default async function UsersViewPage({ searchParams }: UsersViewPageProps) {
  const user = await getUserFromSession();
  const access = getUsersAccess(user);

  if (!access.canRead) {
    const fallback = getUsersDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Usuarios</h2>
        <p>Sem permissao para visualizar usuarios.</p>
      </section>
    );
  }

  const [users, referenceData] = await Promise.all([
    listUsers(),
    getUsersReferenceData().catch(() => ({ hotels: [], roles: [] }))
  ]);

  const activeUserId = String(searchParams?.userId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <section>
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem" }}>Usuarios</h1>
        <PermissionTabs
          activeKey="view"
          items={[
            { key: "create", label: "Criar usuario", href: "/dashboard/users/create", isVisible: access.canCreate },
            { key: "view", label: "Ver usuarios", href: "/dashboard/users/view", isVisible: access.canRead }
          ]}
        />
        <UserStatusMessage status={searchParams?.status} />
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        {users.length ? (
          users.map((item) => (
            <UserListItem
              key={item.id}
              userItem={item}
              hotels={referenceData.hotels}
              roles={referenceData.roles}
              canRead={access.canRead}
              canUpdate={access.canUpdate}
              canDelete={access.canDelete}
              isCurrentUser={user?.id === item.id}
              isViewing={activeUserId === item.id && mode === "view"}
              isEditing={activeUserId === item.id && mode === "edit"}
            />
          ))
        ) : (
          <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem", color: "#666" }}>
            Nenhum usuario cadastrado ate o momento.
          </article>
        )}
      </section>
    </section>
  );
}
