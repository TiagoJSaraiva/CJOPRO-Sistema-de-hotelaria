import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Cliente criado com sucesso.",
  updated: "Cliente atualizado com sucesso.",
  deleted: "Cliente excluido com sucesso.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha os campos obrigatorios para criar cliente.",
  update_missing_fields: "Preencha id e nome para atualizar cliente.",
  delete_missing_id: "Nao foi possivel identificar o cliente para exclusao.",
  create_error: "Falha ao criar cliente.",
  update_error: "Falha ao atualizar cliente.",
  delete_error: "Falha ao excluir cliente."
};

type CustomerStatusMessageProps = {
  status?: string;
};

export function CustomerStatusMessage({ status }: CustomerStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
