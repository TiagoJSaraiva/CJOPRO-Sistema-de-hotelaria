import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { listProducts } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getProductsAccess, getProductsDefaultRoute } from "../access";
import { ProductsViewFilterableSection } from "../_components/ProductsViewFilterableSection";

type ProductsViewPageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function ProductsViewPage({ searchParams }: ProductsViewPageProps) {
  const user = await getUserFromSession();
  const access = getProductsAccess(user);

  if (!access.canRead) {
    const fallback = getProductsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Produtos</h2>
        <p>Sem permissao para visualizar produtos.</p>
      </section>
    );
  }

  const products = await listProducts();

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Produtos</h1>
        <PermissionTabs
          activeKey="view"
          items={[
            { key: "create", label: "Criar produto", href: "/dashboard/products/create", isVisible: access.canCreate },
            { key: "view", label: "Ver produtos", href: "/dashboard/products/view", isVisible: access.canRead }
          ]}
        />
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      <ProductsViewFilterableSection products={products} canUpdate={access.canUpdate} canDelete={access.canDelete} />
    </section>
  );
}
