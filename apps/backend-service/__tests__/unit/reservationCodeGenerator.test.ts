import { describe, expect, it } from "vitest";
import { generateReservationCode } from "../../src/common/reservationCodeGenerator";

describe("reservationCodeGenerator", () => {
  it("generates a code with exactly 6 characters", () => {
    const code = generateReservationCode();
    expect(code).toHaveLength(6);
  });

  it("generates a code with only valid characters (no I, 1, 0, O)", () => {
    const code = generateReservationCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("generates different codes on subsequent calls", () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(generateReservationCode());
    }
    expect(codes.size).toBeGreaterThan(50);
  });

  it("never includes ambiguous characters I, 1, 0, O", () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateReservationCode();
      expect(code).not.toMatch(/[I1O0]/);
    }
  });

  it("only includes uppercase letters (excluding I, O) and numbers (excluding 0, 1)", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateReservationCode();
      for (const char of code) {
        const isValidLetter = /[A-Z]/.test(char) && !["I", "O"].includes(char);
        const isValidNumber = /[0-9]/.test(char) && !["0", "1"].includes(char);
        expect(isValidLetter || isValidNumber).toBe(true);
      }
    }
  });
});
