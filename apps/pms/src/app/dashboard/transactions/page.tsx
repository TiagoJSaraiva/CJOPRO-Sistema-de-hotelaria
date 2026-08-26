import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getTransactionsAccess, getTransactionsDefaultRoute } from "./access";

type TransactionsPageProps = {
  searchParams?: Promise<{
    status?: string;
    r?: string;
  }>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getTransactionsAccess(user);
  const targetRoute = getTransactionsDefaultRoute(access);
  const statusQuery = resolvedSearchParams?.status ? `?status=${encodeURIComponent(resolvedSearchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Painel Financeiro</h1>
        <p>Sem permissão para visualizar este módulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
