import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getProductsAccess, getProductsDefaultRoute } from "./access";

type ProductsPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await getUserFromSession();
  const access = getProductsAccess(user);
  const targetRoute = getProductsDefaultRoute(access);
  const statusQuery = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Produtos</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
