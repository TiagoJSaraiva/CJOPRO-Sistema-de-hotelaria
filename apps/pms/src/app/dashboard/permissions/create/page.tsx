import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import { getPermissionsAccess, getPermissionsDefaultRoute } from "../access";
import { PermissionCreateForm } from "../_components/PermissionCreateForm";
import { PermissionStatusMessage } from "../_components/PermissionStatusMessage";

type PermissionsCreatePageProps = {
  searchParams?: Promise<{
    status?: string;
    r?: string;
  }>;
};

export default async function PermissionsCreatePage({
  searchParams,
}: PermissionsCreatePageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getPermissionsAccess(user);

  if (!access.canCreate) {
    const fallback = getPermissionsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <DashboardAccessDeniedCard
        title="Permissões"
        message="Sem permissão para criar permissão."
      />
    );
  }

  return (
    <DashboardEntityPageShell
      title="Permissões"
      activeTabKey="create"
      tabs={[
        {
          key: "create",
          label: "Criar permissão",
          href: "/dashboard/permissions/create",
          isVisible: access.canCreate,
        },
        {
          key: "view",
          label: "Ver permissões",
          href: "/dashboard/permissions/view",
          isVisible: access.canRead,
        },
      ]}
      statusContent={
        <PermissionStatusMessage status={resolvedSearchParams?.status} />
      }
    >
      <PermissionCreateForm formKey={resolvedSearchParams?.r} />
    </DashboardEntityPageShell>
  );
}
