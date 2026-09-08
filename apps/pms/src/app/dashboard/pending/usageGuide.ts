import type { UsageGuideDefinition } from "../_components/UsageGuide";
export const pendingGuide: UsageGuideDefinition = {
  id: "operational-pending",
  title: "Tratar pendências do hotel",
  steps: [
    {
      id: "filters",
      target: "pending-filters",
      title: "Encontre sua fila",
      description:
        "Filtre por origem, prioridade, situação, responsável ou sua leitura pessoal.",
    },
    {
      id: "sync",
      target: "pending-sync",
      title: "Confira a atualização",
      description:
        "A atualização verifica as origens do hotel. Falhas preservam as pendências anteriores; a rotina também executa a cada 15 minutos.",
    },
    {
      id: "items",
      target: "pending-items",
      title: "Assuma e trate na origem",
      description:
        "Ler não significa assumir. Assuma uma pendência, abra seu contexto e resolva a causa. Somente a atualização da origem encerra o atendimento.",
    },
  ],
};
