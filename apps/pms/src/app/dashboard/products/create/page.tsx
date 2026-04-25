import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
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

    return <DashboardAccessDeniedCard title="Produtos" message="Sem permissao para criar produto." />;
  }

  return (
    <DashboardEntityPageShell
      title="Produtos"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Criar produto", href: "/dashboard/products/create", isVisible: access.canCreate },
        { key: "view", label: "Ver produtos", href: "/dashboard/products/view", isVisible: access.canRead }
      ]}
      status={searchParams?.status}
    >
      <DashboardCreateFormCard title="Criar produto" submitLabel="Criar produto" action={createProductAction} resetKey={searchParams?.r}>
        <input name="name" placeholder="Nome" required className="pms-field-input" />
        <input name="category" placeholder="Categoria" className="pms-field-input" />
        <input name="unit_price" type="number" min={0} step="0.01" placeholder="Preco unitario" required className="pms-field-input" />
        <select name="status" defaultValue="active" className="pms-field-input">
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
