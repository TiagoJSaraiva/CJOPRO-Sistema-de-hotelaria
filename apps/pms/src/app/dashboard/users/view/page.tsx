import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUsersReferenceData, listUsers } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getUsersAccess, getUsersDefaultRoute } from "../access";
import { UserStatusMessage } from "../_components/UserStatusMessage";
import { UsersViewFilterableSection } from "../_components/UsersViewFilterableSection";

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

    return <DashboardAccessDeniedCard title="Usuarios" message="Sem permissao para visualizar usuarios." />;
  }

  const [users, referenceData] = await Promise.all([
    listUsers(),
    getUsersReferenceData().catch(() => ({ hotels: [], roles: [] }))
  ]);

  const activeUserId = String(searchParams?.userId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";

  return (
    <DashboardEntityPageShell
      title="Usuarios"
      activeTabKey="view"
      tabs={[
        { key: "create", label: "Criar usuario", href: "/dashboard/users/create", isVisible: access.canCreate },
        { key: "view", label: "Ver usuarios", href: "/dashboard/users/view", isVisible: access.canRead }
      ]}
      statusContent={<UserStatusMessage status={searchParams?.status} />}
    >
      <UsersViewFilterableSection
        users={users}
        hotels={referenceData.hotels}
        roles={referenceData.roles}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        currentUserId={user?.id}
        activeUserId={activeUserId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
