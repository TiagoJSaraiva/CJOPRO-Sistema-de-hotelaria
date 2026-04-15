const statusMessages: Record<string, string> = {
  created: "Usuario criado com sucesso.",
  updated: "Usuario atualizado com sucesso.",
  deleted: "Usuario excluido com sucesso.",
  delete_conflict: "Usuario nao pode ser excluido enquanto possuir dependencias ativas.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha os campos obrigatorios de criacao.",
  update_missing_fields: "Preencha id, nome e email para atualizar usuario.",
  delete_missing_id: "Nao foi possivel identificar o usuario para exclusao.",
  create_error: "Falha ao criar usuario.",
  update_error: "Falha ao atualizar usuario.",
  delete_error: "Falha ao excluir usuario."
};

type UserStatusMessageProps = {
  status?: string;
};

export function UserStatusMessage({ status }: UserStatusMessageProps) {
  if (!status || !statusMessages[status]) {
    return null;
  }

  const isError = status.includes("error") || status.includes("forbidden") || status.includes("missing") || status.includes("conflict");

  return <p style={{ marginBottom: 0, color: isError ? "#b00020" : "#1f6f51" }}>{statusMessages[status]}</p>;
}
