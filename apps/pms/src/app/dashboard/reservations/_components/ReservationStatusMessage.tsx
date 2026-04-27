import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Reserva criada com sucesso.",
  updated: "Reserva atualizada com sucesso.",
  deleted: "Reserva excluida com sucesso.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha os campos obrigatorios para criar reserva.",
  update_missing_fields: "Preencha id e campos obrigatorios para atualizar reserva.",
  delete_missing_id: "Nao foi possivel identificar a reserva para exclusao.",
  create_error: "Falha ao criar reserva.",
  update_error: "Falha ao atualizar reserva.",
  delete_error: "Falha ao excluir reserva."
};

type ReservationStatusMessageProps = {
  status?: string;
};

export function ReservationStatusMessage({ status }: ReservationStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
