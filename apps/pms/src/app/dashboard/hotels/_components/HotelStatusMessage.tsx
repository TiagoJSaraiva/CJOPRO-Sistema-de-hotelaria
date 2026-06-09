import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Hotel criado com sucesso.",
  updated: "Hotel atualizado com sucesso.",
  deleted: "Hotel excluído com sucesso.",
  delete_conflict: "Hotel não pode ser excluído enquanto possuir dependências ativas.",
  forbidden: "Você não tem permissão para esta operação.",
  create_missing_fields: "Preencha todos os campos obrigatórios do cadastro inicial.",
  update_missing_fields: "Preencha id, nome e slug para atualizar hotel.",
  delete_missing_id: "Não foi possível identificar o hotel para exclusão.",
  create_error: "Falha ao criar hotel.",
  update_error: "Falha ao atualizar hotel.",
  delete_error: "Falha ao excluir hotel."
};

type HotelStatusMessageProps = {
  status?: string;
};

export function HotelStatusMessage({ status }: HotelStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
