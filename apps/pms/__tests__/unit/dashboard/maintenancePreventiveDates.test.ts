import { afterEach, describe, expect, it } from "vitest";
import { futureDates } from "../../../src/app/dashboard/maintenance/_components/preventiveDates";

const originalZone = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalZone;
});

describe("prévia das próximas competências", () => {
  it.each([
    "America/Sao_Paulo",
    "UTC",
    "Pacific/Auckland",
    "Pacific/Kiritimati",
  ])("não muda o dia no fuso %s", (zone) => {
    process.env.TZ = zone;
    expect(futureDates("2026-12-15", "daily", 1).slice(0, 2)).toEqual([
      "2026-12-15",
      "2026-12-16",
    ]);
  });

  it("avança por semanas", () => {
    expect(futureDates("2026-12-15", "weekly", 2).slice(0, 2)).toEqual([
      "2026-12-15",
      "2026-12-29",
    ]);
  });

  it("normaliza o dia 31 para o último dia do mês", () => {
    expect(futureDates("2027-01-31", "monthly", 1).slice(0, 3)).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
    ]);
  });

  it("normaliza 29 de fevereiro na recorrência anual", () => {
    expect(futureDates("2028-02-29", "yearly", 1).slice(0, 2)).toEqual([
      "2028-02-29",
      "2029-02-28",
    ]);
  });
});
