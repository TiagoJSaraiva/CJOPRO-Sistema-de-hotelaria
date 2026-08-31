import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Permissão criada com sucesso.",
  updated: "Permissão atualizada com sucesso.",
  deleted: "Permissão excluída com sucesso.",
  delete_conflict:
    "Permissão não pode ser excluída enquanto possuir dependências ativas.",
  forbidden: "Você não tem permissão para esta operação.",
  create_missing_fields: "Preencha o nome da permissão.",
  update_missing_fields: "Preencha id e nome para atualizar permissão.",
  delete_missing_id: "Não foi possível identificar a permissão para exclusão.",
  create_error: "Falha ao criar permissão.",
  update_error: "Falha ao atualizar permissão.",
  delete_error: "Falha ao excluir permissão.",
};

type PermissionStatusMessageProps = {
  status?: string;
};

export function PermissionStatusMessage({
  status,
}: PermissionStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
