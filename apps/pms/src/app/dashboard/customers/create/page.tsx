import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import { createCustomerAction } from "../actions";
import { getCustomersAccess, getCustomersDefaultRoute } from "../access";

type CustomersCreatePageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function CustomersCreatePage({ searchParams }: CustomersCreatePageProps) {
  const user = await getUserFromSession();
  const access = getCustomersAccess(user);

  if (!access.canCreate) {
    const fallback = getCustomersDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Clientes" message="Sem permissao para criar cliente." />;
  }

  return (
    <DashboardEntityPageShell
      title="Clientes"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Criar cliente", href: "/dashboard/customers/create", isVisible: access.canCreate },
        { key: "view", label: "Ver clientes", href: "/dashboard/customers/view", isVisible: access.canRead }
      ]}
      status={searchParams?.status}
    >
      <DashboardCreateFormCard title="Criar cliente" submitLabel="Criar cliente" action={createCustomerAction} resetKey={searchParams?.r}>
        <input name="full_name" placeholder="Nome completo" required className="pms-field-input" />
        <input name="document_number" placeholder="Documento" required className="pms-field-input" />
        <input name="document_type" placeholder="Tipo de documento" required className="pms-field-input" />
        <input name="birth_date" type="date" required className="pms-field-input" />
        <input name="email" type="email" placeholder="Email" className="pms-field-input" />
        <input name="mobile_phone" placeholder="Celular" className="pms-field-input" />
        <input name="phone" placeholder="Telefone" className="pms-field-input" />
        <input name="nationality" placeholder="Nacionalidade" className="pms-field-input" />
        <input name="notes" placeholder="Observacoes" className="pms-field-input" />
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
