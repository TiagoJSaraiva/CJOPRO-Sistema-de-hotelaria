import { DashboardStatusMessage } from "../../_components/DashboardStatusMessage";

const statusMessages: Record<string, string> = {
  created: "Produto criado com sucesso.",
  updated: "Produto atualizado com sucesso.",
  deleted: "Produto excluído com sucesso.",
  forbidden: "Você não tem permissão para esta operação.",
  create_missing_fields: "Preencha nome e preço unitário para criar produto.",
  update_missing_fields:
    "Preencha id, nome e preço unitário para atualizar produto.",
  delete_missing_id: "Não foi possível identificar o produto para exclusão.",
  create_error: "Falha ao criar produto.",
  update_error: "Falha ao atualizar produto.",
  delete_error: "Falha ao excluir produto.",
};

type ProductStatusMessageProps = {
  status?: string;
};

export function ProductStatusMessage({ status }: ProductStatusMessageProps) {
  return <DashboardStatusMessage status={status} messages={statusMessages} />;
}
