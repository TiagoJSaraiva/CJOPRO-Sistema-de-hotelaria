import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUsersReferenceData } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getUsersAccess, getUsersDefaultRoute } from "../access";
import { UserCreateForm } from "../_components/UserCreateForm";
import { UserStatusMessage } from "../_components/UserStatusMessage";

type UsersCreatePageProps = {
  searchParams?: {
    status?: string;
    r?: string;
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

    return <DashboardAccessDeniedCard title="Usuarios" message="Sem permissao para criar usuario." />;
  }

  const referenceData = await getUsersReferenceData().catch(() => ({ hotels: [], roles: [] }));

  return (
    <DashboardEntityPageShell
      title="Usuarios"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Criar usuario", href: "/dashboard/users/create", isVisible: access.canCreate },
        { key: "view", label: "Ver usuarios", href: "/dashboard/users/view", isVisible: access.canRead }
      ]}
      statusContent={<UserStatusMessage status={searchParams?.status} />}
    >
      <UserCreateForm formKey={searchParams?.r} hotels={referenceData.hotels} roles={referenceData.roles} />
    </DashboardEntityPageShell>
  );
}
