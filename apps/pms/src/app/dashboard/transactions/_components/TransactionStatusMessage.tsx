import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Lançamento financeiro criado com sucesso.",
  updated: "Lançamento financeiro atualizado com sucesso.",
  deleted: "Lançamento financeiro excluído com sucesso.",
  forbidden: "Você não tem permissão para esta operação.",
  create_missing_fields:
    "Preencha tipo, categoria, valor, moeda, datas e vínculos válidos para criar lançamento.",
  update_missing_fields:
    "Preencha id, tipo, categoria, valor, moeda, datas e vínculos válidos para atualizar lançamento.",
  delete_missing_id: "Não foi possível identificar o lançamento para exclusão.",
  create_error: "Falha ao criar lançamento financeiro.",
  update_error: "Falha ao atualizar lançamento financeiro.",
  delete_error: "Falha ao excluir lançamento financeiro.",
};

type TransactionStatusMessageProps = {
  status?: string;
};

export function TransactionStatusMessage({
  status,
}: TransactionStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
