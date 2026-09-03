import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import { listProductCategories } from "../../../../lib/adminApi";
import { getProductsAccess, getProductsDefaultRoute } from "../access";
import { ProductStatusMessage } from "../_components/ProductStatusMessage";
import { productCategoriesGuide } from "../usageGuides";
import {
  archiveProductCategoryAction,
  createProductCategoryAction,
  updateProductCategoryAction,
} from "../actions";

type ProductCategoriesPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

export default async function ProductCategoriesPage({
  searchParams,
}: ProductCategoriesPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getProductsAccess(user);
  if (!access.canRead) {
    const fallback = getProductsDefaultRoute(access);
    if (fallback) redirect(fallback);
    return (
      <DashboardAccessDeniedCard
        title="Categorias de produtos"
        message="Sem permissão para visualizar categorias."
      />
    );
  }
  const categories = await listProductCategories(true);
  return (
    <DashboardEntityPageShell
      title="Categorias de produtos"
      activeTabKey="categories"
      usageGuide={productCategoriesGuide}
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
      <section className="grid gap-4" data-usage-guide="products-categories">
        {access.canCreate ? (
          <form
            action={createProductCategoryAction}
            className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_150px_auto] md:items-end"
          >
            <label className="pms-field">
              Nome
              <input name="name" required className="pms-field-input" />
            </label>
            <label className="pms-field">
              Ordem
              <input
                name="display_order"
                type="number"
                min={0}
                defaultValue={categories.length}
                className="pms-field-input"
              />
            </label>
            <button className="rounded-lg bg-[#1c6d4e] px-3 py-2 text-white">
              Criar categoria
            </button>
          </form>
        ) : null}
        <div className="grid gap-3">
          {categories.map((category) => (
            <form
              key={category.id}
              action={updateProductCategoryAction}
              className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_120px_auto_auto] md:items-end"
            >
              <input type="hidden" name="id" value={category.id} />
              <input
                type="hidden"
                name="archived"
                value={category.archived_at ? "false" : "true"}
              />
              <label className="pms-field">
                Nome
                <input
                  name="name"
                  defaultValue={category.name}
                  disabled={!access.canUpdate}
                  className="pms-field-input"
                />
              </label>
              <label className="pms-field">
                Ordem
                <input
                  name="display_order"
                  type="number"
                  min={0}
                  defaultValue={category.display_order}
                  disabled={!access.canUpdate}
                  className="pms-field-input"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={category.is_active}
                  disabled={!access.canUpdate}
                  className="h-6 w-6 shrink-0"
                />
                Ativa
              </label>
              {access.canUpdate ? (
                <button className="rounded border px-3 py-2">Salvar</button>
              ) : null}
              {access.canDelete ? (
                <button
                  formAction={archiveProductCategoryAction}
                  className="rounded border px-3 py-2"
                >
                  {category.archived_at ? "Restaurar" : "Arquivar"}
                </button>
              ) : null}
            </form>
          ))}
        </div>
      </section>
    </DashboardEntityPageShell>
  );
}
