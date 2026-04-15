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
  if (!status || !statusMessages[status]) {
    return null;
  }

  const isError = status.includes("error") || status.includes("forbidden") || status.includes("missing") || status.includes("conflict");

  return <p style={{ marginBottom: 0, color: isError ? "#b00020" : "#1f6f51" }}>{statusMessages[status]}</p>;
}
