import { describe, expect, it } from "vitest";
import { nextLocalDate } from "../src/app/hotel/[slug]/bookingDates";

describe("nextLocalDate", () => {
  it("usa o dia seguinte local durante o dia", () => {
    expect(nextLocalDate(new Date(2026, 10, 4, 14, 0))).toBe("2026-11-05");
  });

  it("não pula um dia à noite, quando a data UTC já virou (QA-007)", () => {
    expect(nextLocalDate(new Date(2026, 10, 4, 21, 30))).toBe("2026-11-05");
    expect(nextLocalDate(new Date(2026, 10, 4, 23, 59))).toBe("2026-11-05");
  });

  it("não volta um dia de madrugada", () => {
    expect(nextLocalDate(new Date(2026, 10, 5, 0, 1))).toBe("2026-11-06");
  });

  it("atravessa fim de mês, fim de ano e ano bissexto", () => {
    expect(nextLocalDate(new Date(2026, 10, 30, 12, 0))).toBe("2026-12-01");
    expect(nextLocalDate(new Date(2026, 11, 31, 12, 0))).toBe("2027-01-01");
    expect(nextLocalDate(new Date(2028, 1, 28, 12, 0))).toBe("2028-02-29");
  });
});
