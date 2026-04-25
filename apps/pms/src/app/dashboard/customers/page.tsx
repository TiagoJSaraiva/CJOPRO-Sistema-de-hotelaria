import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getCustomersAccess, getCustomersDefaultRoute } from "./access";

type CustomersPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const user = await getUserFromSession();
  const access = getCustomersAccess(user);
  const targetRoute = getCustomersDefaultRoute(access);
  const statusQuery = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Clientes</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
