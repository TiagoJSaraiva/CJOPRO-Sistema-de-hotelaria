import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listCustomers } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getCustomersAccess, getCustomersDefaultRoute } from "../access";
import { CustomersViewFilterableSection } from "../_components/CustomersViewFilterableSection";

type CustomersViewPageProps = {
  searchParams?: {
    status?: string;
    customerId?: string;
    mode?: string;
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

    return <DashboardAccessDeniedCard title="Clientes" message="Sem permissao para visualizar clientes." />;
  }

  const customers = await listCustomers();
  const activeCustomerId = String(searchParams?.customerId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";

  return (
    <DashboardEntityPageShell
      title="Clientes"
      activeTabKey="view"
      tabs={[
        { key: "create", label: "Criar cliente", href: "/dashboard/customers/create", isVisible: access.canCreate },
        { key: "view", label: "Ver clientes", href: "/dashboard/customers/view", isVisible: access.canRead }
      ]}
      status={searchParams?.status}
    >
      <CustomersViewFilterableSection
        customers={customers}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        activeCustomerId={activeCustomerId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
