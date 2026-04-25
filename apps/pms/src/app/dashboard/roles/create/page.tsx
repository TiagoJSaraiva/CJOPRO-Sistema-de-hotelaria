import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getRolesReferenceData } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getRolesAccess, getRolesDefaultRoute } from "../access";
import { RoleCreateForm } from "../_components/RoleCreateForm";
import { RoleStatusMessage } from "../_components/RoleStatusMessage";

type RolesCreatePageProps = {
  searchParams?: {
    status?: string;
    r?: string;
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

    return <DashboardAccessDeniedCard title="Roles" message="Sem permissao para criar role." />;
  }

  const referenceData = await getRolesReferenceData().catch(() => ({ hotels: [], permissions: [] }));

  return (
    <DashboardEntityPageShell
      title="Roles"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Criar role", href: "/dashboard/roles/create", isVisible: access.canCreate },
        { key: "view", label: "Ver roles", href: "/dashboard/roles/view", isVisible: access.canRead }
      ]}
      statusContent={<RoleStatusMessage status={searchParams?.status} />}
    >
      <RoleCreateForm formKey={searchParams?.r} hotels={referenceData.hotels} permissions={referenceData.permissions} />
    </DashboardEntityPageShell>
  );
}
