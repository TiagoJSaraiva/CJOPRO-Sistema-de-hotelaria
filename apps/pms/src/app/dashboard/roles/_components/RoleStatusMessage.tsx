const statusMessages: Record<string, string> = {
  created: "Role criada com sucesso.",
  updated: "Role atualizada com sucesso.",
  deleted: "Role excluida com sucesso.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha os campos obrigatorios da criacao.",
  update_missing_fields: "Preencha id e nome para atualizar role.",
  delete_missing_id: "Nao foi possivel identificar a role para exclusao.",
  create_error: "Falha ao criar role.",
  update_error: "Falha ao atualizar role.",
  delete_error: "Falha ao excluir role."
};

type RoleStatusMessageProps = {
  status?: string;
};

export function RoleStatusMessage({ status }: RoleStatusMessageProps) {
  if (!status || !statusMessages[status]) {
    return null;
  }

  const isError = status.includes("error") || status.includes("forbidden") || status.includes("missing");

  return <p style={{ marginBottom: 0, color: isError ? "#b00020" : "#1f6f51" }}>{statusMessages[status]}</p>;
}
