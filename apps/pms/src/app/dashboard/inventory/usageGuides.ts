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
  ],
};
