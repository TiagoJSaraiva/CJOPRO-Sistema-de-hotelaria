import type { UsageGuideDefinition } from "../_components/UsageGuide";

export function reservationsOperationsGuide(access: {
  canOverrideReadiness: boolean;
  canRelocate: boolean;
  canExecuteGovernance: boolean;
}): UsageGuideDefinition {
  return {
    id: "reservations-operational-readiness",
    title: "Prontidão e realocação",
    steps: [
      {
        id: "blocks",
        target: "arrival-blocks",
        title: "Entenda os bloqueios",
        description:
          "O motivo e o período explicam as células indisponíveis. Disponibilidade para reservar não substitui a liberação da governança para chegada.",
      },
      {
        id: "occupancy",
        target: "arrival-occupancy",
        title: "Confira quem ficará hospedado",
        description:
          "Quantidade é o número de hóspedes. Titular e acompanhantes são conferidos separadamente.",
      },
      {
        id: "guarantee",
        target: "arrival-guarantee",
        title: "Confira e registre o sinal",
        description:
          "O sinal segue a política contratada e vira crédito na chegada. Não registre o mesmo recebimento também como pagamento da estadia.",
      },
      {
        id: "prearrival",
        target: "arrival-prearrival",
        title: "Prepare a pré-chegada",
        description:
          "Gere o link, confira titular, acompanhantes e horário enviado. Regenerar revoga o acesso anterior; o formulário não faz check-in.",
      },
      {
        id: "checkin",
        target: "arrival-checkin",
        title: "Confira o horário da chegada",
        description:
          "O relógio operacional e a janela do hotel explicam quando o check-in pode ocorrer. Exceção gerencial não ignora horário nem interdição.",
      },
      {
        id: "readiness",
        target: "room-readiness",
        title: "Leia os três estados do quarto",
        description:
          "Ocupação, governança e manutenção formam a prontidão usada pelo check-in.",
      },
      ...(access.canOverrideReadiness
        ? [
            {
              id: "override",
              target: "readiness-override",
              title: "Justifique a exceção",
              description:
                "Somente quarto não liberado aceita exceção gerencial. Interdição de manutenção nunca pode ser ignorada.",
            },
          ]
        : []),
      ...(access.canRelocate
        ? [
            {
              id: "relocation",
              target: "stay-relocation",
              title: "Realocar reserva afetada",
              description:
                "Compare capacidade e tarifa pública; a diária contratada permanece igual após a troca.",
            },
          ]
        : []),
      ...(access.canExecuteGovernance
        ? [
            {
              id: "pre-departure",
              target: "pre-departure-review",
              title: "Antecipe a conferência de saída",
              description:
                "Durante a hospedagem, abra a vistoria pré-saída para registrar frigobar e avarias antes do checkout.",
            },
          ]
        : []),
    ],
  };
}
