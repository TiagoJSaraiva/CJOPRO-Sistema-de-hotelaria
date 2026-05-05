import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { FormField } from "../../_components/FormField";
import { getUserFromSession } from "../../../../lib/auth";
import { createTransactionAction } from "../actions";
import { getTransactionsAccess, getTransactionsDefaultRoute } from "../access";
import { TransactionStatusMessage } from "../_components/TransactionStatusMessage";
import { translateTransactionStatus, translateTransactionType } from "@hotel/shared";

type TransactionsCreatePageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function TransactionsCreatePage({ searchParams }: TransactionsCreatePageProps) {
  const user = await getUserFromSession();
  const access = getTransactionsAccess(user);

  if (!access.canCreate) {
    const fallback = getTransactionsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Transacoes" message="Sem permissao para criar transacao." />;
  }

  return (
    <DashboardEntityPageShell
      title="Transacoes"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Criar transacao", href: "/dashboard/transactions/create", isVisible: access.canCreate },
        { key: "view", label: "Ver transacoes", href: "/dashboard/transactions/view", isVisible: access.canRead }
      ]}
      statusContent={<TransactionStatusMessage status={searchParams?.status} />}
    >
      <DashboardCreateFormCard
        title="Criar transacao"
        submitLabel="Criar transacao"
        action={createTransactionAction}
        resetKey={searchParams?.r}
      >
        <FormField label="Tipo" htmlFor="create-transaction-type">
          <select id="create-transaction-type" name="type" defaultValue="INCOME" className="pms-field-input">
            <option value="INCOME">{translateTransactionType("INCOME")}</option>
            <option value="EXPENSE">{translateTransactionType("EXPENSE")}</option>
            <option value="REFUND">{translateTransactionType("REFUND")}</option>
          </select>
        </FormField>

        <FormField label="Categoria" htmlFor="create-transaction-category">
          <input id="create-transaction-category" name="category" required className="pms-field-input" />
        </FormField>

        <FormField label="Valor" htmlFor="create-transaction-amount">
          <input id="create-transaction-amount" name="amount" type="number" min={0} step="0.01" required className="pms-field-input" />
        </FormField>

        <FormField label="Moeda" htmlFor="create-transaction-currency">
          <input id="create-transaction-currency" name="currency" defaultValue="BRL" required className="pms-field-input" />
        </FormField>

        <FormField label="Status" htmlFor="create-transaction-status">
          <select id="create-transaction-status" name="status" defaultValue="COMPLETED" className="pms-field-input">
            <option value="PENDING">{translateTransactionStatus("PENDING")}</option>
            <option value="COMPLETED">{translateTransactionStatus("COMPLETED")}</option>
            <option value="FAILED">{translateTransactionStatus("FAILED")}</option>
            <option value="CANCELLED">{translateTransactionStatus("CANCELLED")}</option>
            <option value="REFUNDED">{translateTransactionStatus("REFUNDED")}</option>
          </select>
        </FormField>

        <FormField label="Descricao" htmlFor="create-transaction-description" fullWidth>
          <input id="create-transaction-description" name="description" className="pms-field-input" />
        </FormField>
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
