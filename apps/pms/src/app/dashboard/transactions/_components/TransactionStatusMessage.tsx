import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Lancamento financeiro criado com sucesso.",
  updated: "Lancamento financeiro atualizado com sucesso.",
  deleted: "Lancamento financeiro excluido com sucesso.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha tipo, categoria, valor, moeda, datas e vinculos validos para criar lancamento.",
  update_missing_fields: "Preencha id, tipo, categoria, valor, moeda, datas e vinculos validos para atualizar lancamento.",
  delete_missing_id: "Nao foi possivel identificar o lancamento para exclusao.",
  create_error: "Falha ao criar lancamento financeiro.",
  update_error: "Falha ao atualizar lancamento financeiro.",
  delete_error: "Falha ao excluir lancamento financeiro."
};

type TransactionStatusMessageProps = {
  status?: string;
};

export function TransactionStatusMessage({ status }: TransactionStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
