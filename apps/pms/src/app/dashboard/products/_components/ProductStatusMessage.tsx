import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Produto criado com sucesso.",
  updated: "Produto atualizado com sucesso.",
  deleted: "Produto excluido com sucesso.",
  forbidden: "Voce nao tem permissao para esta operacao.",
  create_missing_fields: "Preencha nome e preco unitario para criar produto.",
  update_missing_fields: "Preencha id, nome e preco unitario para atualizar produto.",
  delete_missing_id: "Nao foi possivel identificar o produto para exclusao.",
  create_error: "Falha ao criar produto.",
  update_error: "Falha ao atualizar produto.",
  delete_error: "Falha ao excluir produto."
};

type ProductStatusMessageProps = {
  status?: string;
};

export function ProductStatusMessage({ status }: ProductStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
