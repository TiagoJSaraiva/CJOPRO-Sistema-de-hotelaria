import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import { getPermissionsAccess, getPermissionsDefaultRoute } from "../access";
import { PermissionCreateForm } from "../_components/PermissionCreateForm";
import { PermissionStatusMessage } from "../_components/PermissionStatusMessage";

type PermissionsCreatePageProps = {
  searchParams?: {
    status?: string;
    r?: string;
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

    return <DashboardAccessDeniedCard title="Permissoes" message="Sem permissao para criar permissao." />;
  }

  return (
    <DashboardEntityPageShell
      title="Permissoes"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Criar permissao", href: "/dashboard/permissions/create", isVisible: access.canCreate },
        { key: "view", label: "Ver permissoes", href: "/dashboard/permissions/view", isVisible: access.canRead }
      ]}
      statusContent={<PermissionStatusMessage status={searchParams?.status} />}
    >
      <PermissionCreateForm formKey={searchParams?.r} />
    </DashboardEntityPageShell>
  );
}
