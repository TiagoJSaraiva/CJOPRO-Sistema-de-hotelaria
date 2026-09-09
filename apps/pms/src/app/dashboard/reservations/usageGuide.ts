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
