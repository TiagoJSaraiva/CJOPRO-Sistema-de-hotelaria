import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listPermissions } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getPermissionsAccess, getPermissionsDefaultRoute } from "../access";
import { PermissionStatusMessage } from "../_components/PermissionStatusMessage";
import { PermissionsViewFilterableSection } from "../_components/PermissionsViewFilterableSection";

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

    return <DashboardAccessDeniedCard title="Permissões" message="Sem permissão para visualizar permissões." />;
  }

  const activePermissionId = String(searchParams?.permissionId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";
  const permissions = await listPermissions();
  const currentUserPermissionNames = Array.from(new Set(user?.permissions || []));

  return (
    <DashboardEntityPageShell
      title="Permissões"
      activeTabKey="view"
      tabs={[
        { key: "create", label: "Criar permissão", href: "/dashboard/permissions/create", isVisible: access.canCreate },
        { key: "view", label: "Ver permissões", href: "/dashboard/permissions/view", isVisible: access.canRead }
      ]}
      statusContent={<PermissionStatusMessage status={searchParams?.status} />}
    >
      <PermissionsViewFilterableSection
        permissions={permissions}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        currentUserPermissionNames={currentUserPermissionNames}
        activePermissionId={activePermissionId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
