import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getUsersReferenceData } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getUsersAccess, getUsersDefaultRoute } from "../access";
import { UserCreateForm } from "../_components/UserCreateForm";
import { UserStatusMessage } from "../_components/UserStatusMessage";

type UsersCreatePageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function UsersCreatePage({ searchParams }: UsersCreatePageProps) {
  const user = await getUserFromSession();
  const access = getUsersAccess(user);

  if (!access.canCreate) {
    const fallback = getUsersDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Usuarios</h2>
        <p>Sem permissao para criar usuario.</p>
      </section>
    );
  }

  const referenceData = await getUsersReferenceData().catch(() => ({ hotels: [], roles: [] }));

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <section>
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem" }}>Usuarios</h1>
        <PermissionTabs
          activeKey="create"
          items={[
            { key: "create", label: "Criar usuario", href: "/dashboard/users/create", isVisible: access.canCreate },
            { key: "view", label: "Ver usuarios", href: "/dashboard/users/view", isVisible: access.canRead }
          ]}
        />
        <UserStatusMessage status={searchParams?.status} />
      </section>

      <UserCreateForm hotels={referenceData.hotels} roles={referenceData.roles} />
    </section>
  );
}
