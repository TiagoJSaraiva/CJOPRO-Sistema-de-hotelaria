import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUsersReferenceData, listUsers } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getUsersAccess, getUsersDefaultRoute } from "../access";
import { UserStatusMessage } from "../_components/UserStatusMessage";
import { UsersViewFilterableSection } from "../_components/UsersViewFilterableSection";

type UsersViewPageProps = {
  searchParams?: Promise<{
    status?: string;
    userId?: string;
    mode?: string;
  }>;
};

export default async function UsersViewPage({
  searchParams,
}: UsersViewPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getUsersAccess(user);

  if (!access.canRead) {
    const fallback = getUsersDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <DashboardAccessDeniedCard
        title="Usuários"
        message="Sem permissão para visualizar usuários."
      />
    );
  }

  const [users, referenceData] = await Promise.all([
    listUsers(),
    getUsersReferenceData().catch(() => ({ hotels: [], roles: [] })),
  ]);

  const activeUserId = String(resolvedSearchParams?.userId || "").trim();
  const mode = resolvedSearchParams?.mode === "edit" ? "edit" : "view";

  return (
    <DashboardEntityPageShell
      title="Usuários"
      activeTabKey="view"
      tabs={[
        {
          key: "create",
          label: "Criar usuário",
          href: "/dashboard/users/create",
          isVisible: access.canCreate,
        },
        {
          key: "view",
          label: "Ver usuários",
          href: "/dashboard/users/view",
          isVisible: access.canRead,
        },
      ]}
      statusContent={
        <UserStatusMessage status={resolvedSearchParams?.status} />
      }
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
