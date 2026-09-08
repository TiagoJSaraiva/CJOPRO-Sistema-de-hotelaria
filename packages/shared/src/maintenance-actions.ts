import type { MaintenanceWorkOrderStatus } from "./admin";

export const maintenanceActionLabels = {
  assign: "Atribuir responsável",
  start: "Iniciar serviço",
  pause: "Pausar serviço",
  wait: "Colocar em espera",
  resume: "Retomar serviço",
  complete: "Concluir execução",
  cancel: "Cancelar ordem",
  reopen: "Reabrir ordem",
} as const;
export type MaintenanceAction = keyof typeof maintenanceActionLabels;
const actions: Record<
  MaintenanceWorkOrderStatus,
  readonly MaintenanceAction[]
> = {
  pending: ["assign", "cancel"],
  assigned: ["start", "assign", "cancel"],
  in_progress: ["pause", "wait", "complete", "assign", "cancel"],
  paused: ["resume", "assign", "cancel"],
  waiting: ["resume", "assign", "cancel"],
  awaiting_inspection: [],
  completed: ["reopen"],
  canceled: [],
};
export function maintenanceActions(
  status: MaintenanceWorkOrderStatus,
  canTriage: boolean,
  canExecute: boolean,
): readonly MaintenanceAction[] {
  return actions[status].filter((action) =>
    action === "assign" ? canTriage : canTriage || canExecute,
  );
}
export function maintenanceDecisionError(input: {
  action?: string;
  notes?: string | null;
  diagnosis?: string | null;
  waiting_reason?: string | null;
}): string | null {
  if (
    ["pause", "wait", "complete", "cancel", "reopen"].includes(
      input.action || "",
    ) &&
    !input.notes?.trim()
  )
    return "Informe o motivo ou serviço realizado.";
  if (input.action === "complete" && !input.diagnosis?.trim())
    return "Informe o diagnóstico.";
  if (
    input.action === "wait" &&
    !["parts", "vendor", "authorization", "access", "other"].includes(
      input.waiting_reason || "",
    )
  )
    return "Escolha o motivo da espera.";
  return null;
}
export function maintenanceEventLabel(event: string): string {
  const labels: Record<string, string> = {
    occurrence_created: "Ocorrência registrada",
    occurrence_reported: "Ocorrência registrada",
    occurrence_triaged: "Triagem realizada",
    occurrence_reopened: "Ocorrência reaberta",
    occurrence_canceled: "Ocorrência cancelada",
    occurrence_duplicated: "Duplicidade identificada",
    occurrence_duplicate: "Duplicidade identificada",
    occurrence_marked_duplicate: "Duplicidade identificada",
    comment_added: "Comentário",
    inspection_approved: "Inspeção aprovada",
    inspection_rejected: "Inspeção reprovada",
    work_order_created: "Ordem criada",
    work_order_assigned: "Responsável atribuído",
    work_order_started: "Serviço iniciado",
    work_order_paused: "Serviço pausado",
    work_order_waiting: "Serviço em espera",
    work_order_resumed: "Serviço retomado",
    work_order_completed: "Execução concluída",
    work_order_canceled: "Ordem cancelada",
    work_order_reopened: "Ordem reaberta",
  };
  if (labels[event]) return labels[event];
  const action = event.replace(/^work_order_/, "") as MaintenanceAction;
  return event.startsWith("work_order_") && maintenanceActionLabels[action]
    ? maintenanceActionLabels[action]
    : "Atualização do atendimento";
}
