import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Temporada criada com sucesso.",
  updated: "Temporada atualizada com sucesso.",
  deleted: "Temporada excluida com sucesso.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha nome, inicio e fim para criar temporada.",
  update_missing_fields: "Preencha id, nome, inicio e fim para atualizar temporada.",
  delete_missing_id: "Nao foi possivel identificar a temporada para exclusao.",
  create_error: "Falha ao criar temporada.",
  update_error: "Falha ao atualizar temporada.",
  delete_error: "Falha ao excluir temporada."
};

type SeasonStatusMessageProps = {
  status?: string;
};

export function SeasonStatusMessage({ status }: SeasonStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
