import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listFinancialTransactions } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getTransactionsAccess, getTransactionsDefaultRoute } from "../access";
import { TransactionsViewFilterableSection } from "../_components/TransactionsViewFilterableSection";
import { TransactionStatusMessage } from "../_components/TransactionStatusMessage";

type TransactionsViewPageProps = {
  searchParams?: {
    status?: string;
    transactionId?: string;
    mode?: string;
  };
};

export default async function TransactionsViewPage({ searchParams }: TransactionsViewPageProps) {
  const user = await getUserFromSession();
  const access = getTransactionsAccess(user);

  if (!access.canRead) {
    const fallback = getTransactionsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Painel Financeiro" message="Sem permissao para visualizar lançamentos financeiros." />;
  }

  const transactions = await listFinancialTransactions();
  const activeTransactionId = String(searchParams?.transactionId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";

  return (
    <DashboardEntityPageShell
      title="Painel Financeiro"
      activeTabKey="view"
      tabs={[
        { key: "create", label: "Lancamento", href: "/dashboard/transactions/create", isVisible: access.canCreate },
        { key: "view", label: "Monitoramento", href: "/dashboard/transactions/view", isVisible: access.canRead }
      ]}
      statusContent={<TransactionStatusMessage status={searchParams?.status} />}
    >
      <TransactionsViewFilterableSection
        transactions={transactions}
        canCreate={access.canCreate}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        activeTransactionId={activeTransactionId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
