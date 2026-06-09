import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Quarto criado com sucesso.",
  updated: "Quarto atualizado com sucesso.",
  deleted: "Quarto excluído com sucesso.",
  forbidden: "Você não tem permissão para esta operação.",
  create_missing_fields: "Preencha número, tipo, capacidade máxima e diária base para criar quarto.",
  update_missing_fields: "Preencha id, número, tipo, capacidade máxima e diária base para atualizar quarto.",
  delete_missing_id: "Não foi possível identificar o quarto para exclusão.",
  create_error: "Falha ao criar quarto.",
  update_error: "Falha ao atualizar quarto.",
  delete_error: "Falha ao excluir quarto."
};

type RoomStatusMessageProps = {
  status?: string;
};

export function RoomStatusMessage({ status }: RoomStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
