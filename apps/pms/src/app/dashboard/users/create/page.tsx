import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUsersReferenceData } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getUsersAccess, getUsersDefaultRoute } from "../access";
import { UserCreateForm } from "../_components/UserCreateForm";
import { UserStatusMessage } from "../_components/UserStatusMessage";

type UsersCreatePageProps = {
  searchParams?: Promise<{
    status?: string;
    r?: string;
  }>;
};

export default async function UsersCreatePage({ searchParams }: UsersCreatePageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getUsersAccess(user);

  if (!access.canCreate) {
    const fallback = getUsersDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Usuários" message="Sem permissão para criar usuário." />;
  }

  const referenceData = await getUsersReferenceData().catch(() => ({ hotels: [], roles: [] }));

  return (
    <DashboardEntityPageShell
      title="Usuários"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Criar usuário", href: "/dashboard/users/create", isVisible: access.canCreate },
        { key: "view", label: "Ver usuários", href: "/dashboard/users/view", isVisible: access.canRead }
      ]}
      statusContent={<UserStatusMessage status={resolvedSearchParams?.status} />}
    >
      <UserCreateForm formKey={resolvedSearchParams?.r} hotels={referenceData.hotels} roles={referenceData.roles} />
    </DashboardEntityPageShell>
  );
}
