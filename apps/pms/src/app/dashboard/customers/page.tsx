import { getUserFromSession } from "../../../lib/auth";
import { listCustomers } from "../../../lib/adminApi";
import { getCustomersAccess } from "./access";
import { createCustomerAction, deleteCustomerAction, updateCustomerAction } from "./actions";

type CustomersPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const user = await getUserFromSession();
  const access = getCustomersAccess(user);

  if (!access.canRead && !access.canCreate) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Clientes</h1>
        <p>Sem permissao para acessar este modulo.</p>
      </section>
    );
  }

  const customers = access.canRead ? await listCustomers() : [];

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Clientes</h1>
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      {access.canCreate ? (
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
      ) : null}

      {access.canRead ? (
        <section className="grid gap-[0.75rem]">
          {customers.map((customer) => (
            <article key={customer.id} className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
              <h3 className="m-0">{customer.full_name}</h3>
              <p className="m-0 mt-[0.2rem] text-[#555]">{customer.document_type}: {customer.document_number}</p>

              {access.canUpdate ? (
                <form action={updateCustomerAction} className="mt-[0.65rem] grid gap-[0.45rem] md:grid-cols-3">
                  <input type="hidden" name="id" value={customer.id} />
                  <input name="full_name" defaultValue={customer.full_name} required className="pms-field-input" />
                  <input name="document_number" defaultValue={customer.document_number} required className="pms-field-input" />
                  <input name="document_type" defaultValue={customer.document_type} required className="pms-field-input" />
                  <input name="birth_date" type="date" defaultValue={customer.birth_date} required className="pms-field-input" />
                  <input name="email" type="email" defaultValue={customer.email || ""} className="pms-field-input" />
                  <input name="mobile_phone" defaultValue={customer.mobile_phone || ""} className="pms-field-input" />
                  <input name="phone" defaultValue={customer.phone || ""} className="pms-field-input" />
                  <input name="nationality" defaultValue={customer.nationality || ""} className="pms-field-input" />
                  <input name="notes" defaultValue={customer.notes || ""} className="pms-field-input" />
                  <button type="submit" className="justify-self-start rounded-lg border border-[#0f766e] bg-white px-[0.65rem] py-[0.45rem] text-[#0a5f58]">
                    Salvar
                  </button>
                </form>
              ) : null}

              {access.canDelete ? (
                <form action={deleteCustomerAction} className="mt-[0.45rem]">
                  <input type="hidden" name="id" value={customer.id} />
                  <button type="submit" className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]">
                    Apagar
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}
