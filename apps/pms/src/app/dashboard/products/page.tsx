import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getProductsAccess, getProductsDefaultRoute } from "./access";

type ProductsPageProps = {
  searchParams?: Promise<{
    status?: string;
    r?: string;
  }>;
};

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getProductsAccess(user);
  const targetRoute = getProductsDefaultRoute(access);
  const statusQuery = resolvedSearchParams?.status
    ? `?status=${encodeURIComponent(resolvedSearchParams.status)}`
    : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Produtos</h1>
        <p>Sem permissão para visualizar este módulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
