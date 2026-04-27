import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Quarto criado com sucesso.",
  updated: "Quarto atualizado com sucesso.",
  deleted: "Quarto excluido com sucesso.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha numero, tipo, capacidade maxima e diaria base para criar quarto.",
  update_missing_fields: "Preencha id, numero, tipo, capacidade maxima e diaria base para atualizar quarto.",
  delete_missing_id: "Nao foi possivel identificar o quarto para exclusao.",
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
