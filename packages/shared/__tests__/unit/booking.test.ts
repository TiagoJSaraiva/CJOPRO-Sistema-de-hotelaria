import { describe, expect, it } from "vitest";
import { amendmentDelta, calculateCancellationPenalty, calculateGuarantee, calculateNightPrice, isHoldActive } from "../../src/booking";

describe("booking rules", () => {
  it("calcula garantias e penalidades sem ultrapassar regras monetárias", () => {
    expect(calculateGuarantee({ type: "none", value: 0 }, 900, 300)).toBe(0);
    expect(calculateGuarantee({ type: "fixed", value: 120 }, 900, 300)).toBe(120);
    expect(calculateGuarantee({ type: "percentage", value: 30 }, 900, 300)).toBe(270);
    expect(calculateGuarantee({ type: "first_night", value: 0 }, 900, 300)).toBe(300);
    expect(calculateCancellationPenalty({ type: "none", value: 0 }, 900, 300)).toBe(0);
    expect(calculateCancellationPenalty({ type: "fixed", value: 100 }, 900, 300)).toBe(100);
    expect(calculateCancellationPenalty({ type: "percentage", value: 10 }, 900, 300)).toBe(90);
    expect(calculateCancellationPenalty({ type: "first_night", value: 0 }, 900, 300)).toBe(300);
    expect(calculateCancellationPenalty({ type: "full_stay", value: 0 }, 900, 300)).toBe(900);
  });

  it("combina base, temporada, ajuste e ocupação", () => {
    expect(calculateNightPrice({ base: 200, seasonal: 50, adjustmentType: "percentage", adjustmentValue: -10, adults: 3, children: 2, includedAdults: 2, includedChildren: 1, extraAdult: 40, extraChild: 20 })).toBe(285);
    expect(calculateNightPrice({ base: 200, seasonal: 0, adjustmentType: "fixed", adjustmentValue: 25, adults: 1, children: 0, includedAdults: 1, includedChildren: 0, extraAdult: 40, extraChild: 20 })).toBe(225);
  });

  it("preserva datas comuns e identifica o delta", () => {
    expect(amendmentDelta([{ date: "2026-09-10", amount: 100 }, { date: "2026-09-11", amount: 100 }], [{ date: "2026-09-11", amount: 100 }, { date: "2026-09-12", amount: 140 }])).toEqual({ preserved: ["2026-09-11"], removed: ["2026-09-10"], added: ["2026-09-12"], delta: 40 });
  });

  it("considera somente holds vigentes", () => {
    const now = new Date("2026-09-10T12:00:00Z");
    expect(isHoldActive("held", "2026-09-10T13:00:00Z", now)).toBe(true);
    expect(isHoldActive("held", "2026-09-10T11:00:00Z", now)).toBe(false);
    expect(isHoldActive("confirmed", "2026-09-10T13:00:00Z", now)).toBe(false);
    expect(isHoldActive("held", null, now)).toBe(false);
  });
});
