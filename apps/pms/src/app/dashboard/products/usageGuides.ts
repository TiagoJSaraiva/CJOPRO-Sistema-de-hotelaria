import type { UsageGuideDefinition } from "../_components/UsageGuide";

export const productsCatalogGuide: UsageGuideDefinition = {
  id: "products-catalog",
  title: "Catálogo de produtos e serviços",
  steps: [
    {
      id: "navigation",
      target: "products-catalog-header",
      title: "Organize o catálogo",
      description:
        "Use as abas para cadastrar itens, consultar o catálogo e manter categorias do hotel ativo.",
    },
    {
      id: "filters",
      target: "products-filters",
      title: "Encontre um item",
      description:
        "Filtre por código, categoria, tipo, situação e arquivamento antes de editar.",
    },
    {
      id: "history",
      target: "products-history",
      title: "Confira a trilha",
      description:
        "A ficha registra quem criou, alterou, ativou ou arquivou o item.",
    },
  ],
};

export const productsCreateGuide: UsageGuideDefinition = {
  id: "products-create",
  title: "Cadastrar produto ou serviço",
  steps: [
    {
      id: "navigation",
      target: "products-create-header",
      title: "Cadastre para o hotel ativo",
      description:
        "Cada item pertence ao hotel selecionado e será usado nas próximas etapas de consumo.",
    },
    {
      id: "form",
      target: "products-create-form",
      title: "Defina a venda",
      description:
        "Categoria, tipo, unidade e preço orientam a identificação operacional do item.",
    },
  ],
};

export const productCategoriesGuide: UsageGuideDefinition = {
  id: "product-categories",
  title: "Organizar categorias",
  steps: [
    {
      id: "navigation",
      target: "product-categories-header",
      title: "Estruture o catálogo",
      description:
        "Categorias pertencem ao hotel ativo e definem a ordem usada na organização dos itens.",
    },
    {
      id: "management",
      target: "products-categories",
      title: "Mantenha o ciclo de vida",
      description:
        "Ative, inative, ordene, arquive ou restaure categorias conforme a operação do hotel.",
    },
  ],
};
