const statusMessages: Record<string, string> = {
  created: "Role criada com sucesso.",
  updated: "Role atualizada com sucesso.",
  deleted: "Role excluida com sucesso.",
  delete_conflict: "Role nao pode ser excluida enquanto possuir dependencias ativas.",
  delete_not_found: "A role que voce tentou excluir nao foi encontrada.",
  delete_error_network: "Falha de rede ao tentar excluir role. Tente novamente.",
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
  detail?: string;
};

export function RoleStatusMessage({ status, detail }: RoleStatusMessageProps) {
  if (!status || !statusMessages[status]) {
    return null;
  }

  const isError = status.includes("error") || status.includes("forbidden") || status.includes("missing") || status.includes("conflict");
  const showDetail = isError && !!detail;
  const renderedText = showDetail ? `${statusMessages[status]} Detalhe tecnico: ${detail}` : statusMessages[status];

  return <p style={{ marginBottom: 0, color: isError ? "#b00020" : "#1f6f51" }}>{renderedText}</p>;
}
