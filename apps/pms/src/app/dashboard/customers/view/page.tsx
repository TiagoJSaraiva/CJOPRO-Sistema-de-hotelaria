import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { listCustomers } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getCustomersAccess, getCustomersDefaultRoute } from "../access";
import { CustomersViewFilterableSection } from "../_components/CustomersViewFilterableSection";

type CustomersViewPageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function CustomersViewPage({ searchParams }: CustomersViewPageProps) {
  const user = await getUserFromSession();
  const access = getCustomersAccess(user);

  if (!access.canRead) {
    const fallback = getCustomersDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Clientes</h2>
        <p>Sem permissao para visualizar clientes.</p>
      </section>
    );
  }

  const customers = await listCustomers();

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Clientes</h1>
        <PermissionTabs
          activeKey="view"
          items={[
            { key: "create", label: "Criar cliente", href: "/dashboard/customers/create", isVisible: access.canCreate },
            { key: "view", label: "Ver clientes", href: "/dashboard/customers/view", isVisible: access.canRead }
          ]}
        />
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      <CustomersViewFilterableSection customers={customers} canUpdate={access.canUpdate} canDelete={access.canDelete} />
    </section>
  );
}
