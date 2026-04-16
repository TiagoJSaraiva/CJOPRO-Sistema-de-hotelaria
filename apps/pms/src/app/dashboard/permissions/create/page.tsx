import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
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

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Permissoes</h2>
        <p>Sem permissao para criar permissao.</p>
      </section>
    );
  }

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Permissoes</h1>
        <PermissionTabs
          activeKey="create"
          items={[
            { key: "create", label: "Criar permissao", href: "/dashboard/permissions/create", isVisible: access.canCreate },
            { key: "view", label: "Ver permissoes", href: "/dashboard/permissions/view", isVisible: access.canRead }
          ]}
        />
        <PermissionStatusMessage status={searchParams?.status} />
      </section>

      <PermissionCreateForm formKey={searchParams?.r} />
    </section>
  );
}
