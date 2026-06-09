import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { FormField } from "../../_components/FormField";
import { getUserFromSession } from "../../../../lib/auth";
import { createCustomerAction } from "../actions";
import { getCustomersAccess, getCustomersDefaultRoute } from "../access";
import { CustomerStatusMessage } from "../_components/CustomerStatusMessage";

type CustomersCreatePageProps = {
  searchParams?: {
    status?: string;
    detail?: string;
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

    return <DashboardAccessDeniedCard title="Clientes" message="Sem permissão para criar cliente." />;
  }

  return (
    <DashboardEntityPageShell
      title="Clientes"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Criar cliente", href: "/dashboard/customers/create", isVisible: access.canCreate },
        { key: "view", label: "Ver clientes", href: "/dashboard/customers/view", isVisible: access.canRead }
      ]}
      statusContent={<CustomerStatusMessage status={searchParams?.status} detail={searchParams?.detail} />}
    >
      <DashboardCreateFormCard title="Criar cliente" submitLabel="Criar cliente" action={createCustomerAction} resetKey={searchParams?.r}>
        <FormField label="Nome completo" htmlFor="create-customer-full-name">
          <input id="create-customer-full-name" name="full_name" required className="pms-field-input" />
        </FormField>

        <FormField label="Documento" htmlFor="create-customer-document-number">
          <input id="create-customer-document-number" name="document_number" required className="pms-field-input" />
        </FormField>

        <FormField label="Tipo de documento" htmlFor="create-customer-document-type">
          <input id="create-customer-document-type" name="document_type" required className="pms-field-input" />
        </FormField>

        <FormField label="Data de nascimento" htmlFor="create-customer-birth-date">
          <input id="create-customer-birth-date" name="birth_date" type="date" required className="pms-field-input" />
        </FormField>

        <FormField label="Email" htmlFor="create-customer-email">
          <input id="create-customer-email" name="email" type="email" className="pms-field-input" />
        </FormField>

        <FormField label="Celular" htmlFor="create-customer-mobile-phone">
          <input id="create-customer-mobile-phone" name="mobile_phone" className="pms-field-input" />
        </FormField>

        <FormField label="Telefone" htmlFor="create-customer-phone">
          <input id="create-customer-phone" name="phone" className="pms-field-input" />
        </FormField>

        <FormField label="Nacionalidade" htmlFor="create-customer-nationality">
          <input id="create-customer-nationality" name="nationality" className="pms-field-input" />
        </FormField>

        <FormField label="Observações" htmlFor="create-customer-notes" fullWidth>
          <input id="create-customer-notes" name="notes" className="pms-field-input" />
        </FormField>
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
