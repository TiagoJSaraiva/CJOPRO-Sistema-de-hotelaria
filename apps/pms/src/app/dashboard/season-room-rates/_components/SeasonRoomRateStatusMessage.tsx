import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Tarifa de temporada criada com sucesso.",
  updated: "Tarifa de temporada atualizada com sucesso.",
  deleted: "Tarifa de temporada excluida com sucesso.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha temporada, tipo de quarto e valor diario para criar tarifa.",
  update_missing_fields: "Preencha id, temporada, tipo de quarto e valor diario para atualizar tarifa.",
  delete_missing_id: "Nao foi possivel identificar a tarifa para exclusao.",
  create_error: "Falha ao criar tarifa de temporada.",
  update_error: "Falha ao atualizar tarifa de temporada.",
  delete_error: "Falha ao excluir tarifa de temporada."
};

type SeasonRoomRateStatusMessageProps = {
  status?: string;
};

export function SeasonRoomRateStatusMessage({ status }: SeasonRoomRateStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
