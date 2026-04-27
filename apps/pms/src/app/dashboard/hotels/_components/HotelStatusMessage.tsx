import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Hotel criado com sucesso.",
  updated: "Hotel atualizado com sucesso.",
  deleted: "Hotel excluido com sucesso.",
  delete_conflict: "Hotel nao pode ser excluido enquanto possuir dependencias ativas.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha todos os campos obrigatorios do cadastro inicial.",
  update_missing_fields: "Preencha id, nome e slug para atualizar hotel.",
  delete_missing_id: "Nao foi possivel identificar o hotel para exclusao.",
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
