import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Transacao criada com sucesso.",
  updated: "Transacao atualizada com sucesso.",
  deleted: "Transacao excluida com sucesso.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha tipo, categoria, valor e status validos para criar transacao.",
  update_missing_fields: "Preencha id, tipo, categoria, valor e status validos para atualizar transacao.",
  delete_missing_id: "Nao foi possivel identificar a transacao para exclusao.",
  create_error: "Falha ao criar transacao.",
  update_error: "Falha ao atualizar transacao.",
  delete_error: "Falha ao excluir transacao."
};

type TransactionStatusMessageProps = {
  status?: string;
};

export function TransactionStatusMessage({ status }: TransactionStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
