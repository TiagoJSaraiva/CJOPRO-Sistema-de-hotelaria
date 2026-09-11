import type { UsageGuideDefinition } from "../_components/UsageGuide";

export const inventoryGuide: UsageGuideDefinition = {
  id: "inventory",
  title: "Controle básico de estoque",
  steps: [
    {
      id: "overview",
      target: "inventory-overview",
      title: "Acompanhe saldos",
      description:
        "Veja mínimos, sugestões de reposição e saldos negativos por produto e local.",
    },
    {
      id: "movement",
      target: "inventory-movement-form",
      title: "Registre movimentos",
      description:
        "Entradas, ajustes, perdas, uso interno e transferências sempre geram lançamentos imutáveis.",
    },
    {
      id: "count",
      target: "inventory-counts",
      title: "Conte sem congelar",
      description:
        "Abra uma sessão, informe quantidades e conclua; mudanças concorrentes exigem nova contagem.",
    },
    {
      id: "audit",
      target: "inventory-audit",
      title: "Revise a auditoria",
      description:
        "Consulte quem alterou configurações, locais, posições e documentos do estoque.",
    },
    {
      id: "settings",
      target: "inventory-settings",
      title: "Configure a operação",
      description:
        "Defina locais, mínimos e se saldo insuficiente bloqueia ou apenas alerta o lançamento de consumo.",
    },
    {
      id: "lots",
      target: "inventory-lots",
      title: "Controle lotes e validade",
      description:
        "Distribua o saldo ao ativar a rastreabilidade; saídas usam primeiro o lote que vence antes.",
    },
    {
      id: "minibar",
      target: "inventory-minibar",
      title: "Reponha os frigobares",
      description:
        "Composições versionadas mostram a falta por quarto e geram uma rota a partir do estoque abastecedor.",
    },
  ],
};
