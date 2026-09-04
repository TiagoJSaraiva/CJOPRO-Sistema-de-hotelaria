const messages: Record<string, string> = {
  created: "Configuração criada com sucesso.",
  "contact-created": "Contato comercial adicionado com sucesso.",
  "revision-created": "Nova revisão criada em rascunho.",
  activated: "Revisão comercial ativada com sucesso.",
  terminated: "Revisão comercial encerrada com sucesso.",
  updated: "Configuração atualizada com sucesso.",
  reordered: "Ordem atualizada com sucesso.",
  invalid: "Revise os campos obrigatórios e a política de cobrança.",
  conflict:
    "Não foi possível salvar. Verifique duplicidades, arquivamento e vínculos do hotel ativo.",
  forbidden: "Você não possui permissão para alterar estas configurações.",
};

export function ConsumptionStatusMessage({ status }: { status?: string }) {
  if (!status || !messages[status]) return null;
  const error = ["invalid", "conflict", "forbidden"].includes(status);
  return (
    <p
      role={error ? "alert" : "status"}
      className={error ? "pms-status-error" : "pms-status-success"}
    >
      {messages[status]}
    </p>
  );
}
