import type { UsageGuideDefinition } from "../_components/UsageGuide";

export const maintenanceOverviewGuide: UsageGuideDefinition = {
  id: "maintenance-overview",
  title: "Central de manutenção",
  steps: [
    {
      id: "navigation",
      target: "maintenance-overview-header",
      title: "Navegue pela manutenção",
      description:
        "As abas exibem somente as áreas permitidas para o seu perfil. Use-as para alternar entre operação, agenda, gestão e financeiro.",
    },
    {
      id: "summary",
      target: "maintenance-overview-summary",
      title: "Priorize o atendimento",
      description:
        "O resumo mostra volume aberto, atrasos, inspeções e quartos bloqueados do hotel ativo.",
    },
    {
      id: "filters",
      target: "maintenance-overview-filters",
      title: "Encontre uma ocorrência",
      description:
        "Combine busca, situação e prioridade. As abas também oferecem recortes rápidos, como suas ordens e itens atrasados.",
    },
    {
      id: "list",
      target: "maintenance-overview-list",
      title: "Abra o contexto completo",
      description:
        "Cada cartão resume alvo, situação, bloqueio e ordens abertas. Abra-o para executar ou acompanhar o trabalho.",
    },
  ],
};

export const maintenanceReportGuide: UsageGuideDefinition = {
  id: "maintenance-report",
  title: "Registrar ocorrência",
  steps: [
    {
      id: "navigation",
      target: "maintenance-report-header",
      title: "Registre o problema",
      description:
        "Este formulário cria a ocorrência inicial. Triagem, ordens, bloqueio efetivo e apuração acontecem depois no detalhe.",
    },
    {
      id: "target",
      target: "maintenance-report-target",
      title: "Identifique o alvo",
      description:
        "Escolha um quarto ou uma área/equipamento. Quando houver estadia relacionada, vinculá-la preserva o contexto operacional.",
    },
    {
      id: "classification",
      target: "maintenance-report-classification",
      title: "Classifique a ocorrência",
      description:
        "Tipo, categoria e prioridade determinam o contexto, a fila e os prazos de atendimento aplicáveis.",
    },
    {
      id: "details",
      target: "maintenance-report-details",
      title: "Descreva impacto e risco",
      description:
        "Informe sinais observados e impacto. Recomendar bloqueio alerta a triagem, mas ainda não interdita o quarto.",
    },
    {
      id: "evidence",
      target: "maintenance-report-evidence",
      title: "Anexe evidências",
      description:
        "Fotos ajudam a diagnosticar e auditar o atendimento. Respeite quantidade, formato e tamanho indicados.",
    },
    {
      id: "submit",
      target: "maintenance-report-submit",
      title: "Conclua o registro",
      description:
        "Ao registrar, você será levado ao detalhe da ocorrência para acompanhar as próximas etapas.",
    },
  ],
};

const maintenanceOccurrenceBaseGuide: UsageGuideDefinition = {
  id: "maintenance-occurrence",
  title: "Detalhe da ocorrência",
  steps: [
    {
      id: "navigation",
      target: "maintenance-occurrence-header",
      title: "Acompanhe uma ocorrência",
      description:
        "O detalhe reúne contexto, execução, bloqueio, responsabilidade, evidências e histórico conforme suas permissões.",
    },
    {
      id: "summary",
      target: "maintenance-occurrence-summary",
      title: "Confira situação e prazos",
      description:
        "Valide alvo, prioridade, origem, responsabilidade, bloqueio e SLAs antes de agir.",
    },
    {
      id: "orders",
      target: "maintenance-occurrence-orders",
      title: "Trabalhe por ordens",
      description:
        "As ordens distribuem responsáveis, instruções, checklist, execução externa e eventual inspeção.",
    },
    {
      id: "block",
      target: "maintenance-occurrence-block",
      title: "Controle a disponibilidade",
      description:
        "Um bloqueio ativo retira o quarto da disponibilidade até uma liberação explícita, mesmo após a previsão de término.",
    },
    {
      id: "liability",
      target: "maintenance-occurrence-liability",
      title: "Apure responsabilidade",
      description:
        "Em danos, a triagem pode marcar uma suspeita; outro usuário autorizado confirma ou descarta após a apuração.",
    },
    {
      id: "evidence",
      target: "maintenance-occurrence-evidence",
      title: "Preserve evidências",
      description:
        "Consulte ou acrescente fotos. Remoções exigem motivo e preservam o histórico de auditoria.",
    },
    {
      id: "history",
      target: "maintenance-occurrence-history",
      title: "Consulte a trilha",
      description:
        "Comentários e eventos registram decisões e mudanças de estado da ocorrência.",
    },
  ],
};

export function getMaintenanceOccurrenceGuide(
  canReadFinance: boolean,
): UsageGuideDefinition {
  if (!canReadFinance) return maintenanceOccurrenceBaseGuide;
  const financeStep = {
    id: "finance",
    target: "maintenance-occurrence-finance",
    title: "Acompanhe custos e recuperações",
    description:
      "Valores, documentos, propostas e estados financeiros aparecem somente para perfis autorizados.",
  };
  return {
    ...maintenanceOccurrenceBaseGuide,
    steps: [
      ...maintenanceOccurrenceBaseGuide.steps.slice(0, 5),
      financeStep,
      ...maintenanceOccurrenceBaseGuide.steps.slice(5),
    ],
  };
}

export const maintenanceFinanceGuide: UsageGuideDefinition = {
  id: "maintenance-finance",
  title: "Financeiro de manutenção",
  steps: [
    {
      id: "navigation",
      target: "maintenance-finance-header",
      title: "Trabalhe pelas filas financeiras",
      description:
        "As abas separam aprovação, contas a pagar, recuperações a receber, vencidos e itens já liquidados.",
    },
    {
      id: "summary",
      target: "maintenance-finance-summary",
      title: "Confira a exposição financeira",
      description:
        "Os totais mostram os valores ainda a pagar e a receber no hotel ativo.",
    },
    {
      id: "items",
      target: "maintenance-finance-items",
      title: "Aprove ou liquide conforme sua função",
      description:
        "A proposta, a aprovação e a liquidação são etapas independentes. O autor não pode aprovar o próprio item.",
    },
  ],
};

export const maintenanceCheckoutGuide: UsageGuideDefinition = {
  id: "maintenance-checkout",
  title: "Checkout e manutenção",
  steps: [
    {
      id: "navigation",
      target: "maintenance-checkout-header",
      title: "Revise a saída por quarto",
      description:
        "O checkout reúne estadia, pagamentos e pendências de manutenção vinculadas ao quarto pesquisado.",
    },
    {
      id: "search",
      target: "maintenance-checkout-search",
      title: "Localize a estadia",
      description:
        "Pesquise o quarto em check-in para carregar os dados operacionais e financeiros disponíveis ao seu perfil.",
    },
    {
      id: "stay",
      target: "maintenance-checkout-stay",
      title: "Confira a estadia",
      description:
        "Antes de confirmar, valide hóspede, reserva, datas, situação financeira e elegibilidade.",
    },
    {
      id: "acknowledgement",
      target: "maintenance-checkout-acknowledgement",
      title: "Registre ciência das pendências",
      description:
        "A ciência confirma que ocorrências ou cobranças foram revisadas. Ela não atribui responsabilidade, não quita valores e não resolve a ocorrência.",
    },
    {
      id: "actions",
      target: "maintenance-checkout-actions",
      title: "Finalize com segurança",
      description:
        "Revise pagamentos e condições de saída. Depois da ciência exigida, pendências de dano continuam registradas, mas não impedem o checkout.",
    },
  ],
};

export const operationalMaintenanceGuides = [
  maintenanceOverviewGuide,
  maintenanceReportGuide,
  getMaintenanceOccurrenceGuide(false),
];

export const financialMaintenanceGuides = [
  maintenanceFinanceGuide,
  maintenanceCheckoutGuide,
  getMaintenanceOccurrenceGuide(true),
];
