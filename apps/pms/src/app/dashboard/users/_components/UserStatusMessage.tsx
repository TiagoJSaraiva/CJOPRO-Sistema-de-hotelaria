import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Usuário criado com sucesso.",
  updated: "Usuário atualizado com sucesso.",
  deleted: "Usuário excluído com sucesso.",
  delete_conflict:
    "Usuário não pode ser excluído enquanto possuir dependências ativas.",
  forbidden: "Você não tem permissão para esta operação.",
  create_missing_fields: "Preencha os campos obrigatórios de criação.",
  update_missing_fields: "Preencha id, nome e email para atualizar usuário.",
  delete_missing_id: "Não foi possível identificar o usuário para exclusão.",
  create_error: "Falha ao criar usuário.",
  update_error: "Falha ao atualizar usuário.",
  delete_error: "Falha ao excluir usuário.",
};

type UserStatusMessageProps = {
  status?: string;
};

export function UserStatusMessage({ status }: UserStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
