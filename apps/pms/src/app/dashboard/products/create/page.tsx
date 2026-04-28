import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { FormField } from "../../_components/FormField";
import { getUserFromSession } from "../../../../lib/auth";
import { createProductAction } from "../actions";
import { getProductsAccess, getProductsDefaultRoute } from "../access";
import { ProductStatusMessage } from "../_components/ProductStatusMessage";

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
      statusContent={<ProductStatusMessage status={searchParams?.status} />}
    >
      <DashboardCreateFormCard title="Criar produto" submitLabel="Criar produto" action={createProductAction} resetKey={searchParams?.r}>
        <FormField label="Nome" htmlFor="create-product-name">
          <input id="create-product-name" name="name" required className="pms-field-input" />
        </FormField>

        <FormField label="Categoria" htmlFor="create-product-category">
          <input id="create-product-category" name="category" className="pms-field-input" />
        </FormField>

        <FormField label="Preco unitario" htmlFor="create-product-unit-price">
          <input id="create-product-unit-price" name="unit_price" type="number" min={0} step="0.01" required className="pms-field-input" />
        </FormField>

        <FormField label="Status" htmlFor="create-product-status">
          <select id="create-product-status" name="status" defaultValue="active" className="pms-field-input">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </FormField>
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
