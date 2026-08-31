import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Temporada criada com sucesso.",
  updated: "Temporada atualizada com sucesso.",
  deleted: "Temporada excluída com sucesso.",
  forbidden: "Você não tem permissão para esta operação.",
  create_missing_fields: "Preencha nome, início e fim para criar temporada.",
  update_missing_fields:
    "Preencha id, nome, início e fim para atualizar temporada.",
  delete_missing_id: "Não foi possível identificar a temporada para exclusão.",
  create_error: "Falha ao criar temporada.",
  update_error: "Falha ao atualizar temporada.",
  delete_error: "Falha ao excluir temporada.",
};

type SeasonStatusMessageProps = {
  status?: string;
};

export function SeasonStatusMessage({ status }: SeasonStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
