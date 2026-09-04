import type { UsageGuideDefinition } from "../_components/UsageGuide";

export const consumptionLaunchGuide: UsageGuideDefinition = {
  id: "consumption-launch",
  title: "Lançar uma comanda",
  steps: [
    {
      id: "stay",
      target: "consumption-stay-search",
      title: "Localize a estadia",
      description:
        "Busque pelo quarto, código da reserva ou nome do hóspede com check-in.",
    },
    {
      id: "cart",
      target: "consumption-cart",
      title: "Monte o carrinho",
      description:
        "Escolha um ponto e informe as quantidades. Produtos indisponíveis explicam o motivo.",
    },
    {
      id: "billing",
      target: "consumption-billing",
      title: "Defina o desfecho",
      description:
        "Lance no fólio, receba no hotel, confirme o parceiro ou conceda cortesia conforme sua permissão.",
    },
    {
      id: "review",
      target: "consumption-review",
      title: "Revise e confirme",
      description:
        "Confira valores e confirme. O preço e a regra comercial são validados novamente no servidor.",
    },
  ],
};

export const consumptionHistoryGuide: UsageGuideDefinition = {
  id: "consumption-history",
  title: "Consultar comandas",
  steps: [
    {
      id: "filters",
      target: "consumption-history-filters",
      title: "Encontre o lançamento",
      description:
        "Filtre por período, estadia, ponto, cobrança, disposição ou fornecedor.",
    },
    {
      id: "list",
      target: "consumption-history-list",
      title: "Abra o recibo",
      description:
        "Consulte os snapshots preservados e os vínculos financeiros permitidos.",
    },
  ],
};

export const consumptionPointsGuide: UsageGuideDefinition = {
  id: "consumption-points",
  title: "Configurar pontos de consumo",
  steps: [
    {
      id: "navigation",
      target: "consumption-points-header",
      title: "Organize os canais do hotel",
      description:
        "Cadastre canais como Recepção, Frigobar, Restaurante e Piscina para o hotel ativo.",
    },
    {
      id: "create",
      target: "consumption-point-form",
      title: "Defina a cobrança padrão",
      description:
        "Escolha se o ponto aceita pagamento imediato, lançamento no fólio ou ambos.",
    },
    {
      id: "impact",
      target: "consumption-point-list",
      title: "Revise impactos",
      description:
        "Alterações no padrão afetam imediatamente todas as ofertas que continuam herdando a política.",
    },
  ],
};

export const consumptionOffersGuide: UsageGuideDefinition = {
  id: "consumption-offers",
  title: "Disponibilizar itens nos pontos",
  steps: [
    {
      id: "navigation",
      target: "consumption-offers-header",
      title: "Monte as ofertas",
      description:
        "O mesmo produto pode ser disponibilizado em vários pontos do hotel.",
    },
    {
      id: "link",
      target: "consumption-offer-form",
      title: "Vincule produtos em lote",
      description:
        "Selecione um ponto e os produtos que devem aparecer nele. O preço permanece no catálogo.",
    },
    {
      id: "policy",
      target: "consumption-offer-list",
      title: "Entenda a política resolvida",
      description:
        "Cada oferta pode herdar o ponto ou sobrescrever os modos permitidos e a opção sugerida.",
    },
  ],
};

export const commercialPartnersGuide: UsageGuideDefinition = {
  id: "commercial-partners",
  title: "Cadastrar uma empresa parceira",
  steps: [
    {
      id: "create",
      target: "commercial-partner-form",
      title: "Identifique a empresa",
      description:
        "Registre os dados comerciais separados dos fornecedores usados pela manutenção.",
    },
    {
      id: "contacts",
      target: "commercial-partner-list",
      title: "Organize os contatos",
      description:
        "Classifique responsáveis operacionais e financeiros para facilitar a gestão do acordo.",
    },
  ],
};

export const commercialAgreementsGuide: UsageGuideDefinition = {
  id: "commercial-agreements",
  title: "Configurar um acordo de exploração",
  steps: [
    {
      id: "terms",
      target: "commercial-agreement-form",
      title: "Defina modelo e vigência",
      description:
        "Escolha aluguel, comissão ou híbrido, o recebedor e os pontos abrangidos.",
    },
    {
      id: "review",
      target: "commercial-agreement-list",
      title: "Revise antes de ativar",
      description:
        "A ativação torna os termos imutáveis. Mudanças futuras devem usar uma nova revisão.",
    },
  ],
};

export const consumptionAdjustmentsGuide: UsageGuideDefinition = {
  id: "consumption-adjustments",
  title: "Revisar ajustes e reembolsos",
  steps: [
    {
      id: "filters",
      target: "consumption-adjustment-filters",
      title: "Acompanhe a fila",
      description:
        "Filtre solicitações pendentes, concluídas ou que ainda aguardam reembolso.",
    },
    {
      id: "queue",
      target: "consumption-adjustment-queue",
      title: "Compare o impacto",
      description:
        "Confira o valor redutor, o motivo, o solicitante e a versão da conta.",
    },
    {
      id: "decision",
      target: "consumption-adjustment-decision",
      title: "Decida com segregação",
      description:
        "Aprovação precisa ser feita por outra pessoa. Rejeições exigem justificativa.",
    },
    {
      id: "partner-refund",
      target: "consumption-partner-refund",
      title: "Confirme o reembolso externo",
      description:
        "Em pagamento direto, registre a confirmação do parceiro sem movimentar o caixa do hotel.",
    },
  ],
};
