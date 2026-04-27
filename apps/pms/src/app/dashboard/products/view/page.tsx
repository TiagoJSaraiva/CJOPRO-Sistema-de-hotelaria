import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listProducts } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getProductsAccess, getProductsDefaultRoute } from "../access";
import { ProductsViewFilterableSection } from "../_components/ProductsViewFilterableSection";
import { ProductStatusMessage } from "../_components/ProductStatusMessage";

type ProductsViewPageProps = {
  searchParams?: {
    status?: string;
    productId?: string;
    mode?: string;
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

    return <DashboardAccessDeniedCard title="Produtos" message="Sem permissao para visualizar produtos." />;
  }

  const products = await listProducts();
  const activeProductId = String(searchParams?.productId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";

  return (
    <DashboardEntityPageShell
      title="Produtos"
      activeTabKey="view"
      tabs={[
        { key: "create", label: "Criar produto", href: "/dashboard/products/create", isVisible: access.canCreate },
        { key: "view", label: "Ver produtos", href: "/dashboard/products/view", isVisible: access.canRead }
      ]}
      statusContent={<ProductStatusMessage status={searchParams?.status} />}
    >
      <ProductsViewFilterableSection
        products={products}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        activeProductId={activeProductId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
