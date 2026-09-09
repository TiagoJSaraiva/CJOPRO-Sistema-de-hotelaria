import type { UsageGuideDefinition } from "../_components/UsageGuide";

export function governanceGuide(access: {
  canExecute: boolean;
  canPostConsumption: boolean;
  hasMinibarOptions: boolean;
  hasMaintenanceCategories: boolean;
}): UsageGuideDefinition {
  return {
    id: "governance-board",
    title: "Giro e liberação dos quartos",
    steps: [
      {
        id: "summary",
        target: "governance-summary",
        title: "Priorize pela próxima chegada",
        description:
          "Quartos com chegada vencida ou no dia aparecem como críticos.",
      },
      {
        id: "task",
        target: "governance-task",
        title: "Assuma a próxima ação",
        description:
          "A responsabilidade acompanha a tarefa e também aparece na central de pendências.",
      },
      {
        id: "checklist",
        target: "governance-checklist",
        title: "Registre a execução",
        description:
          "Responda todos os itens obrigatórios. Reprovações precisam explicar a pendência.",
      },
      ...(access.canExecute &&
      !access.canPostConsumption &&
      access.hasMinibarOptions
        ? [
            {
              id: "minibar",
              target: "governance-minibar",
              title: "Encaminhe o achado à recepção",
              description:
                "Sem permissão financeira, registre a divergência sem alterar a conta da estadia.",
            },
          ]
        : []),
      ...(access.canExecute && access.hasMaintenanceCategories
        ? [
            {
              id: "defect",
              target: "governance-defect",
              title: "Classifique a avaria",
              description:
                "Avaria impeditiva cria interdição e exige inspeção depois do reparo.",
            },
          ]
        : []),
      {
        id: "handoff",
        target: "governance-handoff",
        title: "Passe o turno com contexto",
        description:
          "Informe o ocorrido e a próxima ação para a equipe seguinte.",
      },
    ],
  };
}
