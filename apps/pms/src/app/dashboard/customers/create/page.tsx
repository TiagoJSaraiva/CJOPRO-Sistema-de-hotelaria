import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
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

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Clientes</h2>
        <p>Sem permissao para criar cliente.</p>
      </section>
    );
  }

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Clientes</h1>
        <PermissionTabs
          activeKey="create"
          items={[
            { key: "create", label: "Criar cliente", href: "/dashboard/customers/create", isVisible: access.canCreate },
            { key: "view", label: "Ver clientes", href: "/dashboard/customers/view", isVisible: access.canRead }
          ]}
        />
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      <article className="pms-surface-card">
        <h3 className="mt-0">Criar cliente</h3>
        <form key={searchParams?.r} action={createCustomerAction} className="grid gap-[0.65rem] md:grid-cols-2">
          <input name="full_name" placeholder="Nome completo" required className="pms-field-input" />
          <input name="document_number" placeholder="Documento" required className="pms-field-input" />
          <input name="document_type" placeholder="Tipo de documento" required className="pms-field-input" />
          <input name="birth_date" type="date" required className="pms-field-input" />
          <input name="email" type="email" placeholder="Email" className="pms-field-input" />
          <input name="mobile_phone" placeholder="Celular" className="pms-field-input" />
          <input name="phone" placeholder="Telefone" className="pms-field-input" />
          <input name="nationality" placeholder="Nacionalidade" className="pms-field-input" />
          <input name="notes" placeholder="Observacoes" className="pms-field-input" />
          <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
            Criar cliente
          </button>
        </form>
      </article>
    </section>
  );
}
