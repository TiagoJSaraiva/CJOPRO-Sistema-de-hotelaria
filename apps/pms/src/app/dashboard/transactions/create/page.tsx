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

    return <DashboardAccessDeniedCard title="Painel Financeiro" message="Sem permissao para criar lançamento financeiro." />;
  }

  return (
    <DashboardEntityPageShell
      title="Painel Financeiro"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Lancamento", href: "/dashboard/transactions/create", isVisible: access.canCreate },
        { key: "view", label: "Monitoramento", href: "/dashboard/transactions/view", isVisible: access.canRead }
      ]}
      statusContent={<TransactionStatusMessage status={searchParams?.status} />}
    >
      <DashboardCreateFormCard
        title="Registrar gasto ou movimentacao"
        submitLabel="Salvar lançamento"
        action={createTransactionAction}
        resetKey={searchParams?.r}
      >
        <FormField label="Tipo" htmlFor="create-transaction-type">
          <select id="create-transaction-type" name="type" defaultValue="EXPENSE" className="pms-field-input">
            <option value="INCOME">{translateTransactionType("INCOME")}</option>
            <option value="EXPENSE">{translateTransactionType("EXPENSE")}</option>
            <option value="REFUND">{translateTransactionType("REFUND")}</option>
          </select>
        </FormField>

        <FormField label="Categoria" htmlFor="create-transaction-category">
          <input id="create-transaction-category" name="category" required placeholder="Ex.: Manutencao, lavanderia" className="pms-field-input" />
        </FormField>

        <FormField label="Fornecedor ou favorecido" htmlFor="create-transaction-counterparty">
          <input id="create-transaction-counterparty" name="counterparty" placeholder="Ex.: Energia SP" className="pms-field-input" />
        </FormField>

        <FormField label="Centro de custo" htmlFor="create-transaction-cost-center">
          <input id="create-transaction-cost-center" name="cost_center" placeholder="Ex.: Operacao, Governanca" className="pms-field-input" />
        </FormField>

        <FormField label="Valor" htmlFor="create-transaction-amount">
          <input id="create-transaction-amount" name="amount" type="number" min={0} step="0.01" required className="pms-field-input" />
        </FormField>

        <FormField label="Moeda" htmlFor="create-transaction-currency">
          <input id="create-transaction-currency" name="currency" defaultValue="BRL" required className="pms-field-input" />
        </FormField>

        <FormField label="Status" htmlFor="create-transaction-status">
          <select id="create-transaction-status" name="status" defaultValue="PENDING" className="pms-field-input">
            <option value="PENDING">{translateTransactionStatus("PENDING")}</option>
            <option value="COMPLETED">{translateTransactionStatus("COMPLETED")}</option>
            <option value="FAILED">{translateTransactionStatus("FAILED")}</option>
            <option value="CANCELLED">{translateTransactionStatus("CANCELLED")}</option>
            <option value="REFUNDED">{translateTransactionStatus("REFUNDED")}</option>
          </select>
        </FormField>

        <FormField label="Vencimento" htmlFor="create-transaction-due-date">
          <input id="create-transaction-due-date" name="due_date" type="date" className="pms-field-input" />
        </FormField>

        <FormField label="Pago em" htmlFor="create-transaction-paid-at">
          <input id="create-transaction-paid-at" name="paid_at" type="datetime-local" className="pms-field-input" />
        </FormField>

        <FormField label="Metodo de pagamento" htmlFor="create-transaction-payment-method">
          <input id="create-transaction-payment-method" name="payment_method" placeholder="PIX, cartao, dinheiro" className="pms-field-input" />
        </FormField>

        <FormField label="Documento/referencia" htmlFor="create-transaction-reference-code">
          <input id="create-transaction-reference-code" name="reference_code" placeholder="NF, recibo, pedido interno" className="pms-field-input" />
        </FormField>

        <FormField label="Reserva vinculada" htmlFor="create-transaction-reservation-id">
          <input id="create-transaction-reservation-id" name="reservation_id" placeholder="UUID da reserva, se houver" className="pms-field-input" />
        </FormField>

        <FormField label="Estadia vinculada" htmlFor="create-transaction-stay-id">
          <input id="create-transaction-stay-id" name="stay_id" placeholder="UUID da estadia, se houver" className="pms-field-input" />
        </FormField>

        <FormField label="Descricao" htmlFor="create-transaction-description" fullWidth>
          <input id="create-transaction-description" name="description" placeholder="Observacoes operacionais, aprovador ou contexto" className="pms-field-input" />
        </FormField>
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
