import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import {
  listProductCategories,
  listProductHistory,
  listProducts,
  listConsumptionOffers,
} from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getProductsAccess, getProductsDefaultRoute } from "../access";
import { ProductsViewFilterableSection } from "../_components/ProductsViewFilterableSection";
import { ProductStatusMessage } from "../_components/ProductStatusMessage";
import { productsCatalogGuide } from "../usageGuides";
import { PERMISSIONS } from "@hotel/shared";
import Link from "next/link";

type ProductsViewPageProps = {
  searchParams?: Promise<{
    status?: string;
    productId?: string;
    mode?: string;
  }>;
};

export default async function ProductsViewPage({
  searchParams,
}: ProductsViewPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getProductsAccess(user);

  if (!access.canRead) {
    const fallback = getProductsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <DashboardAccessDeniedCard
        title="Produtos"
        message="Sem permissão para visualizar produtos."
      />
    );
  }

  const products = await listProducts(true);
  const categories = await listProductCategories(true);
  const activeProductId = String(resolvedSearchParams?.productId || "").trim();
  const mode = resolvedSearchParams?.mode === "edit" ? "edit" : "view";

  const history =
    activeProductId && access.canRead
      ? await listProductHistory(activeProductId)
      : [];
  const canReadConsumption =
    user?.permissions.includes(PERMISSIONS.CONSUMPTION_READ) || false;
  const consumptionOffers =
    activeProductId && canReadConsumption
      ? await listConsumptionOffers({
          productId: activeProductId,
          includeArchived: true,
        })
      : [];

  return (
    <DashboardEntityPageShell
      title="Produtos"
      activeTabKey="view"
      usageGuide={productsCatalogGuide}
      tabs={[
        {
          key: "create",
          label: "Novo item",
          href: "/dashboard/products/create",
          isVisible: access.canCreate,
        },
        {
          key: "view",
          label: "Catálogo",
          href: "/dashboard/products/view",
          isVisible: access.canRead,
        },
        {
          key: "categories",
          label: "Categorias",
          href: "/dashboard/products/categories",
          isVisible: access.canRead,
        },
      ]}
      statusContent={
        <ProductStatusMessage status={resolvedSearchParams?.status} />
      }
    >
      {user?.permissions.includes(PERMISSIONS.INVENTORY_READ) ? (
        <aside className="pms-surface-card flex flex-wrap items-center justify-between gap-3">
          <p className="m-0">
            Saldos e locais dos produtos físicos são gerenciados no módulo de
            estoque.
          </p>
          <Link
            className="pms-button-secondary"
            href="/dashboard/inventory/overview"
          >
            Ver estoque
          </Link>
        </aside>
      ) : null}
      <ProductsViewFilterableSection
        products={products}
        categories={categories}
        history={history}
        consumptionOffers={consumptionOffers}
        canReadConsumption={canReadConsumption}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        activeProductId={activeProductId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
