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
  title: "Conta da estadia e checkout",
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
      id: "account",
      target: "stay-account-summary",
      title: "Revise a conta consolidada",
      description:
        "Hospedagem, consumos, manutenção, pagamentos, créditos e reembolsos permanecem separados e auditáveis.",
    },
    {
      id: "tenders",
      target: "stay-account-tenders",
      title: "Divida o pagamento",
      description:
        "Use um ou mais meios e preencha o restante. A soma precisa quitar exatamente o saldo no fechamento.",
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
    {
      id: "statement",
      target: "stay-account-statement",
      title: "Guarde o extrato",
      description:
        "Depois do fechamento, imprima o extrato não fiscal e acompanhe separadamente qualquer correção posterior.",
    },
  ],
};

export const stayAccountGuide: UsageGuideDefinition = {
  id: "stay-account",
  title: "Conta e extrato da estadia",
  steps: [
    {
      id: "summary",
      target: "stay-account-summary",
      title: "Confira a posição da conta",
      description:
        "Hospedagem, consumos e o saldo pagável são consolidados por estadia e atualizados a cada movimentação.",
    },
    {
      id: "lines",
      target: "stay-account-lines",
      title: "Revise débitos e créditos",
      description:
        "O razão preserva cobranças, pagamentos, ajustes e reembolsos. Valores em aberto determinam o que ainda precisa ser resolvido.",
    },
    {
      id: "refund",
      target: "stay-account-refund",
      title: "Conclua reembolsos pendentes",
      description:
        "Uma correção paga só termina após registrar o reembolso. Trocar o meio original exige justificativa operacional.",
    },
    {
      id: "statement",
      target: "stay-account-statement",
      title: "Consulte e imprima o fechamento",
      description:
        "O fechamento original é imutável; correções posteriores aparecem separadas no extrato operacional não fiscal.",
    },
  ],
};

export const maintenanceAgendaGuide: UsageGuideDefinition = {
  id: "maintenance-agenda",
  title: "Minha agenda de manutenção",
  steps: [
    {
      id: "navigation",
      target: "maintenance-agenda-header",
      title: "Acompanhe suas ordens",
      description:
        "A agenda reúne somente ordens abertas atribuídas a você no hotel ativo.",
    },
    {
      id: "groups",
      target: "maintenance-agenda-groups",
      title: "Priorize pelo prazo",
      description:
        "As tarefas são separadas entre atrasadas, previstas para hoje e próximas. Abra uma ordem para executar o checklist e registrar avanços.",
    },
  ],
};

export const maintenancePreventiveGuide: UsageGuideDefinition = {
  id: "maintenance-preventive",
  title: "Manutenção preventiva",
  steps: [
    {
      id: "navigation",
      target: "maintenance-preventive-header",
      title: "Antecipe manutenções",
      description:
        "Planos preventivos geram ocorrências e ordens no mesmo fluxo operacional das correções.",
    },
    {
      id: "plans",
      target: "maintenance-preventive-plans",
      title: "Acompanhe planos e competências",
      description:
        "Confira situação, prioridade, alvo, responsável, próxima data e checklist de cada plano.",
    },
    {
      id: "deferred",
      target: "maintenance-preventive-deferred",
      title: "Resolva competências adiadas",
      description:
        "Uma competência é adiada quando a execução anterior permanece aberta. Gestores podem gerar, reagendar ou ignorar com justificativa.",
    },
    {
      id: "form",
      target: "maintenance-preventive-form",
      title: "Configure um plano",
      description:
        "Defina alvo, recorrência, responsável, instruções e checklist. A recomendação de bloqueio ainda exige confirmação operacional.",
    },
  ],
};

export const maintenanceSuppliersGuide: UsageGuideDefinition = {
  id: "maintenance-suppliers",
  title: "Fornecedores e contratos",
  steps: [
    {
      id: "navigation",
      target: "maintenance-suppliers-header",
      title: "Organize o atendimento externo",
      description:
        "Fornecedores, contatos, contratos e documentos apoiam as ordens, sem substituir o responsável interno.",
    },
    {
      id: "list",
      target: "maintenance-suppliers-list",
      title: "Mantenha o cadastro",
      description:
        "Consulte especialidades, contatos, contratos e arquivos; desative cadastros que não devem receber novas ordens.",
    },
    {
      id: "form",
      target: "maintenance-suppliers-form",
      title: "Cadastre um fornecedor",
      description:
        "Registre identificação e especialidades. Contatos e contratos são adicionados depois no cartão do fornecedor.",
    },
  ],
};

export const maintenanceSettingsGuide: UsageGuideDefinition = {
  id: "maintenance-settings",
  title: "Configuração de manutenção",
  steps: [
    {
      id: "navigation",
      target: "maintenance-settings-header",
      title: "Prepare os dados operacionais",
      description:
        "Categorias, áreas, equipamentos e políticas de SLA alimentam registro, triagem e indicadores.",
    },
    {
      id: "sla-link",
      target: "maintenance-settings-sla-link",
      title: "Acesse as regras de prazo",
      description:
        "As políticas de SLA ficam em uma página própria e definem prazos por prioridade e categoria.",
    },
    {
      id: "categories",
      target: "maintenance-settings-categories",
      title: "Padronize categorias",
      description:
        "Categorias organizam ocorrências, planos e políticas. Desativar preserva o histórico e impede novos usos.",
    },
    {
      id: "locations",
      target: "maintenance-settings-locations",
      title: "Modele áreas e equipamentos",
      description:
        "Cadastre a hierarquia física e, quando aplicável, dados patrimoniais e de garantia dos equipamentos.",
    },
  ],
};

const maintenanceSlaBaseGuide: UsageGuideDefinition = {
  id: "maintenance-sla",
  title: "SLA de manutenção",
  steps: [
    {
      id: "navigation",
      target: "maintenance-sla-header",
      title: "Defina compromissos de atendimento",
      description:
        "As políticas determinam prazos de resposta e resolução copiados para novas ocorrências.",
    },
    {
      id: "precedence",
      target: "maintenance-sla-precedence",
      title: "Entenda a precedência",
      description:
        "Categoria e prioridade prevalecem sobre a prioridade geral, que prevalece sobre o padrão do hotel.",
    },
  ],
};

export function getMaintenanceSlaGuide(
  canManage: boolean,
): UsageGuideDefinition {
  return canManage
    ? {
        ...maintenanceSlaBaseGuide,
        steps: [
          ...maintenanceSlaBaseGuide.steps,
          {
            id: "form",
            target: "maintenance-sla-form",
            title: "Crie uma especialização",
            description:
              "Escolha o escopo mais específico necessário e defina prazos em horas. Ocorrências já abertas mantêm o SLA original.",
          },
        ],
      }
    : maintenanceSlaBaseGuide;
}

export const maintenanceNotificationsGuide: UsageGuideDefinition = {
  id: "maintenance-notifications",
  title: "Alertas de manutenção",
  steps: [
    {
      id: "navigation",
      target: "maintenance-notifications-header",
      title: "Acompanhe exceções e vencimentos",
      description:
        "Alertas chamam atenção para SLA, preventivas adiadas, contratos e garantias.",
    },
    {
      id: "filters",
      target: "maintenance-notifications-filters",
      title: "Organize sua caixa",
      description:
        "Filtre por estado ou tipo e marque todas como lidas quando já tiver revisado o conjunto.",
    },
    {
      id: "list",
      target: "maintenance-notifications-list",
      title: "Abra o contexto",
      description:
        "Abrir leva à ocorrência ou cadastro relacionado. Marcar como lida mantém o alerta; dispensar o retira da caixa ativa.",
    },
  ],
};

const maintenanceAnalyticsBaseGuide: UsageGuideDefinition = {
  id: "maintenance-analytics",
  title: "Indicadores de manutenção",
  steps: [
    {
      id: "navigation",
      target: "maintenance-analytics-header",
      title: "Analise o desempenho",
      description:
        "O painel consolida operação, SLA, preventivas, fornecedores e indisponibilidade do hotel ativo.",
    },
    {
      id: "filters",
      target: "maintenance-analytics-filters",
      title: "Defina o recorte",
      description:
        "Combine período, categoria, prioridade, situação, alvo, plano e fornecedor antes de interpretar os números.",
    },
    {
      id: "summary",
      target: "maintenance-analytics-summary",
      title: "Leia os indicadores principais",
      description:
        "Os cartões resumem backlog, criticidade, conformidade, recorrência e dias de quarto bloqueado.",
    },
    {
      id: "performance",
      target: "maintenance-analytics-performance",
      title: "Investigue tendência e velocidade",
      description:
        "O envelhecimento mostra há quanto tempo o backlog está aberto; desempenho mede triagem, resolução e fornecedores.",
    },
    {
      id: "exports",
      target: "maintenance-analytics-exports",
      title: "Exporte o mesmo recorte",
      description:
        "O CSV detalha ocorrências e o PDF apresenta o resumo executivo com os filtros aplicados.",
    },
  ],
};

export function getMaintenanceAnalyticsGuide(
  canReadFinance: boolean,
): UsageGuideDefinition {
  if (!canReadFinance) return maintenanceAnalyticsBaseGuide;
  return {
    ...maintenanceAnalyticsBaseGuide,
    steps: [
      ...maintenanceAnalyticsBaseGuide.steps.slice(0, 3),
      {
        id: "finance",
        target: "maintenance-analytics-finance",
        title: "Consulte o resultado autorizado",
        description:
          "Custos, recuperações e resultado líquido aparecem somente para usuários com permissão financeira.",
      },
      ...maintenanceAnalyticsBaseGuide.steps.slice(3),
    ],
  };
}

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

export const advancedMaintenanceGuides = [
  maintenanceAgendaGuide,
  maintenancePreventiveGuide,
  maintenanceSuppliersGuide,
  maintenanceSettingsGuide,
  getMaintenanceSlaGuide(false),
  getMaintenanceSlaGuide(true),
  maintenanceNotificationsGuide,
  getMaintenanceAnalyticsGuide(false),
  getMaintenanceAnalyticsGuide(true),
];
