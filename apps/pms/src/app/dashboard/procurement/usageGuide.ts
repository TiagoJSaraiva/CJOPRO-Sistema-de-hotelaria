import type { UsageGuideDefinition } from "../_components/UsageGuide";

export const procurementGuide: UsageGuideDefinition = {
  id: "procurement",
  title: "Reposição e compras",
  steps: [
    {
      id: "shortages",
      target: "procurement-shortages",
      title: "Trate rupturas",
      description:
        "Revise a sugestão por produto e encaminhe apenas a necessidade válida.",
    },
    {
      id: "policy",
      target: "procurement-policy",
      title: "Configure as alçadas",
      description:
        "As faixas definem quantas aprovações e cotações cada valor exige.",
    },
    {
      id: "orders",
      target: "procurement-orders",
      title: "Acompanhe pedidos",
      description:
        "Aprovação, recebimento e nota permanecem separados e auditáveis.",
    },
    {
      id: "invoices",
      target: "procurement-invoices",
      title: "Confira as notas",
      description:
        "Diferenças acima da tolerância impedem a aprovação e exigem decisão por outra pessoa.",
    },
  ],
};
