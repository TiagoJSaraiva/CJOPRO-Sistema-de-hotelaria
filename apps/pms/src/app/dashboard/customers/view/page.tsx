import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listCustomers } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getCustomersAccess, getCustomersDefaultRoute } from "../access";
import { CustomersViewFilterableSection } from "../_components/CustomersViewFilterableSection";
import { CustomerStatusMessage } from "../_components/CustomerStatusMessage";

type CustomersViewPageProps = {
  searchParams?: Promise<{
    status?: string;
    customerId?: string;
    mode?: string;
  }>;
};

export default async function CustomersViewPage({ searchParams }: CustomersViewPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getCustomersAccess(user);

  if (!access.canRead) {
    const fallback = getCustomersDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Clientes" message="Sem permissão para visualizar clientes." />;
  }

  const customers = await listCustomers();
  const activeCustomerId = String(resolvedSearchParams?.customerId || "").trim();
  const mode = resolvedSearchParams?.mode === "edit" ? "edit" : "view";

  return (
    <DashboardEntityPageShell
      title="Clientes"
      activeTabKey="view"
      tabs={[
        { key: "create", label: "Criar cliente", href: "/dashboard/customers/create", isVisible: access.canCreate },
        { key: "view", label: "Ver clientes", href: "/dashboard/customers/view", isVisible: access.canRead }
      ]}
      statusContent={<CustomerStatusMessage status={resolvedSearchParams?.status} />}
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
