import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Cliente criado com sucesso.",
  updated: "Cliente atualizado com sucesso.",
  deleted: "Cliente excluído com sucesso.",
  forbidden: "Você não tem permissão para esta operação.",
  create_missing_fields: "Preencha os campos obrigatórios para criar cliente.",
  update_missing_fields: "Preencha id e nome para atualizar cliente.",
  delete_missing_id: "Não foi possível identificar o cliente para exclusão.",
  create_error: "Falha ao criar cliente.",
  update_error: "Falha ao atualizar cliente.",
  delete_error: "Falha ao excluir cliente.",
};

type CustomerStatusMessageProps = {
  status?: string;
  detail?: string;
};

export function CustomerStatusMessage({
  status,
  detail,
}: CustomerStatusMessageProps) {
  return (
    <DashboardStatusMessage
      status={status}
      detail={detail}
      messages={statusMessages}
    />
  );
}
