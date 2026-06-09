import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getTransactionsAccess, getTransactionsDefaultRoute } from "./access";

type TransactionsPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const user = await getUserFromSession();
  const access = getTransactionsAccess(user);
  const targetRoute = getTransactionsDefaultRoute(access);
  const statusQuery = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Painel Financeiro</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
