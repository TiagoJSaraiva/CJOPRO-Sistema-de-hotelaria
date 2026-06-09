import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Role criada com sucesso.",
  updated: "Role atualizada com sucesso.",
  deleted: "Role excluída com sucesso.",
  delete_conflict: "Role não pode ser excluída enquanto possuir dependências ativas.",
  delete_not_found: "A role que você tentou excluir não foi encontrada.",
  delete_error_network: "Falha de rede ao tentar excluir role. Tente novamente.",
  forbidden: "Você não tem permissão para esta operação.",
  create_missing_fields: "Preencha os campos obrigatórios da criação.",
  update_missing_fields: "Preencha id e nome para atualizar role.",
  delete_missing_id: "Não foi possível identificar a role para exclusão.",
  create_error: "Falha ao criar role.",
  update_error: "Falha ao atualizar role.",
  delete_error: "Falha ao excluir role."
};

type RoleStatusMessageProps = {
  status?: string;
  detail?: string;
};

export function RoleStatusMessage({ status, detail }: RoleStatusMessageProps) {
  return <DashboardStatusMessage status={status} detail={detail} messages={statusMessages} />;
}
