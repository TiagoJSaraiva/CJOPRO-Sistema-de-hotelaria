import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { FormField } from "../../_components/FormField";
import { getUserFromSession } from "../../../../lib/auth";
import { createProductAction } from "../actions";
import { getProductsAccess, getProductsDefaultRoute } from "../access";
import { ProductStatusMessage } from "../_components/ProductStatusMessage";
import { listProductCategories } from "../../../../lib/adminApi";
import { productsCreateGuide } from "../usageGuides";

type ProductsCreatePageProps = {
  searchParams?: Promise<{
    status?: string;
    r?: string;
  }>;
};

export default async function ProductsCreatePage({
  searchParams,
}: ProductsCreatePageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getProductsAccess(user);

  if (!access.canCreate) {
    const fallback = getProductsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <DashboardAccessDeniedCard
        title="Produtos"
        message="Sem permissão para criar produto."
      />
    );
  }

  const categories = await listProductCategories();

  return (
    <DashboardEntityPageShell
      title="Produtos"
      activeTabKey="create"
      usageGuide={productsCreateGuide}
      tabs={[
        {
          key: "create",
          label: "Criar produto",
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
      <div data-usage-guide="products-create-form">
        <p className="pms-status-muted">
          Nesta etapa, todos os itens são fornecidos pelo hotel ativo.
        </p>
        <DashboardCreateFormCard
          title="Criar produto ou serviço"
          submitLabel="Criar item"
          action={createProductAction}
          resetKey={resolvedSearchParams?.r}
        >
          <FormField label="Nome" htmlFor="create-product-name">
            <input
              id="create-product-name"
              name="name"
              required
              className="pms-field-input"
            />
          </FormField>

          <FormField label="Categoria" htmlFor="create-product-category">
            <select
              id="create-product-category"
              name="category_id"
              required
              className="pms-field-input"
            >
              <option value="">Selecione</option>
              {categories
                .filter((category) => category.is_active)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </FormField>

          <FormField label="Código interno" htmlFor="create-product-code">
            <input
              id="create-product-code"
              name="internal_code"
              className="pms-field-input"
            />
          </FormField>

          <FormField label="Descrição" htmlFor="create-product-description">
            <textarea
              id="create-product-description"
              name="description"
              maxLength={1000}
              className="pms-field-input"
            />
          </FormField>

          <FormField label="Tipo" htmlFor="create-product-kind">
            <select
              id="create-product-kind"
              name="kind"
              defaultValue="physical"
              className="pms-field-input"
            >
              <option value="physical">Produto físico</option>
              <option value="service">Serviço</option>
            </select>
          </FormField>

          <FormField
            label="Unidade de venda"
            htmlFor="create-product-sales-unit"
          >
            <select
              id="create-product-sales-unit"
              name="sales_unit"
              defaultValue="unit"
              className="pms-field-input"
            >
              <option value="unit">Unidade</option>
              <option value="portion">Porção</option>
              <option value="person">Pessoa</option>
              <option value="hour">Hora</option>
              <option value="daily">Diária</option>
              <option value="service">Serviço</option>
            </select>
          </FormField>

          <FormField label="Preço unitário" htmlFor="create-product-unit-price">
            <input
              id="create-product-unit-price"
              name="unit_price"
              type="number"
              min={0}
              step="0.01"
              required
              className="pms-field-input"
            />
          </FormField>

          <FormField label="Status" htmlFor="create-product-status">
            <select
              id="create-product-status"
              name="status"
              defaultValue="active"
              className="pms-field-input"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </FormField>
        </DashboardCreateFormCard>
      </div>
    </DashboardEntityPageShell>
  );
}
