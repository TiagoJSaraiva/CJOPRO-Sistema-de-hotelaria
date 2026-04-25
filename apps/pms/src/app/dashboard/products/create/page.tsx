import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getUserFromSession } from "../../../../lib/auth";
import { createProductAction } from "../actions";
import { getProductsAccess, getProductsDefaultRoute } from "../access";

type ProductsCreatePageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function ProductsCreatePage({ searchParams }: ProductsCreatePageProps) {
  const user = await getUserFromSession();
  const access = getProductsAccess(user);

  if (!access.canCreate) {
    const fallback = getProductsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Produtos</h2>
        <p>Sem permissao para criar produto.</p>
      </section>
    );
  }

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Produtos</h1>
        <PermissionTabs
          activeKey="create"
          items={[
            { key: "create", label: "Criar produto", href: "/dashboard/products/create", isVisible: access.canCreate },
            { key: "view", label: "Ver produtos", href: "/dashboard/products/view", isVisible: access.canRead }
          ]}
        />
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      <article className="pms-surface-card">
        <h3 className="mt-0">Criar produto</h3>
        <form key={searchParams?.r} action={createProductAction} className="grid gap-[0.65rem] md:grid-cols-2">
          <input name="name" placeholder="Nome" required className="pms-field-input" />
          <input name="category" placeholder="Categoria" className="pms-field-input" />
          <input name="unit_price" type="number" min={0} step="0.01" placeholder="Preco unitario" required className="pms-field-input" />
          <select name="status" defaultValue="active" className="pms-field-input">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
          <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
            Criar produto
          </button>
        </form>
      </article>
    </section>
  );
}
