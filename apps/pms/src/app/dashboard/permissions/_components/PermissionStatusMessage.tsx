const statusMessages: Record<string, string> = {
  created: "Permissao criada com sucesso.",
  updated: "Permissao atualizada com sucesso.",
  deleted: "Permissao excluida com sucesso.",
  delete_conflict: "Permissao nao pode ser excluida enquanto possuir dependencias ativas.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha o nome da permissao.",
  update_missing_fields: "Preencha id e nome para atualizar permissao.",
  delete_missing_id: "Nao foi possivel identificar a permissao para exclusao.",
  create_error: "Falha ao criar permissao.",
  update_error: "Falha ao atualizar permissao.",
  delete_error: "Falha ao excluir permissao."
};

type PermissionStatusMessageProps = {
  status?: string;
};

export function PermissionStatusMessage({ status }: PermissionStatusMessageProps) {
  if (!status || !statusMessages[status]) {
    return null;
  }

  const isError = status.includes("error") || status.includes("forbidden") || status.includes("missing") || status.includes("conflict");

  return <p className={`mb-0 ${isError ? "text-[#b00020]" : "text-[#1f6f51]"}`}>{statusMessages[status]}</p>;
}
