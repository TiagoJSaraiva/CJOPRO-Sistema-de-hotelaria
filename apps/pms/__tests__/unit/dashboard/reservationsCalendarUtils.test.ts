import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  formatDateRangeLabel,
} from "../../../src/app/dashboard/reservations/_components/calendarUtils";

describe("reservations calendar utils", () => {
  it("avanca e retrocede dias em formato ISO", () => {
    expect(addDaysIso("2026-05-06", 20)).toBe("2026-05-26");
    expect(addDaysIso("2026-05-06", -20)).toBe("2026-04-16");
  });

  it("formata label de intervalo da janela", () => {
    const label = formatDateRangeLabel([
      { date: "2026-05-06", day_number: 6, weekday_short: "qua" },
      { date: "2026-05-25", day_number: 25, weekday_short: "seg" },
    ]);
    expect(label).toBe("06/05/2026 - 25/05/2026");
  });
});
