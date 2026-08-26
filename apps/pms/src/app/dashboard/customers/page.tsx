import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getCustomersAccess, getCustomersDefaultRoute } from "./access";

type CustomersPageProps = {
  searchParams?: Promise<{
    status?: string;
    r?: string;
  }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getCustomersAccess(user);
  const targetRoute = getCustomersDefaultRoute(access);
  const statusQuery = resolvedSearchParams?.status ? `?status=${encodeURIComponent(resolvedSearchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Clientes</h1>
        <p>Sem permissão para visualizar este módulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
