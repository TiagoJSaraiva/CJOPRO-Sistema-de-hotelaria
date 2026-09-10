import { describe, expect, it } from "vitest";
import { calculateMaintenanceImpactScore } from "../src/maintenance-planning";

describe("calculateMaintenanceImpactScore", () => {
  it("preserva a base técnica e explica cada fator operacional", () => {
    expect(
      calculateMaintenanceImpactScore({
        technicalPriority: "normal",
        guestPresent: true,
        nextArrivalHours: 12,
        affectedRooms: 2,
        activeBlock: true,
        impactHours: 30,
        recurrent: true,
      }),
    ).toEqual({
      score: 99,
      recommendedPriority: "critical",
      components: [
        { key: "technical_priority", points: 30 },
        { key: "guest_present", points: 20 },
        { key: "next_arrival", points: 15 },
        { key: "affected_rooms", points: 8 },
        { key: "active_block", points: 10 },
        { key: "impact_duration", points: 8 },
        { key: "recurrence", points: 8 },
      ],
    });
  });

  it("aplica limites de quartos, duração e teto do score", () => {
    const result = calculateMaintenanceImpactScore({
      technicalPriority: "critical",
      guestPresent: true,
      nextArrivalHours: -1,
      affectedRooms: 200,
      activeBlock: true,
      impactHours: 72,
      recurrent: true,
    });
    expect(result.score).toBe(100);
    expect(result.components).toContainEqual({
      key: "affected_rooms",
      points: 16,
    });
    expect(result.components).toContainEqual({
      key: "impact_duration",
      points: 15,
    });
  });

  it.each([
    ["low", 10, "low"],
    ["normal", 30, "normal"],
    ["high", 55, "high"],
    ["critical", 80, "critical"],
  ] as const)(
    "mapeia %s para a faixa correspondente",
    (priority, score, band) => {
      expect(
        calculateMaintenanceImpactScore({
          technicalPriority: priority,
          guestPresent: false,
          nextArrivalHours: null,
          affectedRooms: 0,
          activeBlock: false,
          impactHours: 0,
          recurrent: false,
        }),
      ).toMatchObject({ score, recommendedPriority: band });
    },
  );
});
