import { describe, expect, it } from "vitest";
import { maximizeBenefit, validatePayerAllocation } from "../../src";

describe("consumption journey rules", () => {
  it("maximizes value and breaks ties by expiration then grant", () => {
    expect(
      maximizeBenefit(18, [
        {
          id: "later",
          availableAmount: 20,
          expiresAt: "2026-12-01",
          grantedAt: "2026-01-01",
        },
        {
          id: "first",
          availableAmount: 10,
          expiresAt: "2026-10-01",
          grantedAt: "2026-02-01",
        },
        {
          id: "older",
          availableAmount: 10,
          expiresAt: "2026-10-01",
          grantedAt: "2026-01-01",
        },
      ]),
    ).toEqual([
      { id: "older", amount: 10 },
      { id: "first", amount: 8 },
    ]);
  });

  it("validates allocations in cents without floating-point drift", () => {
    expect(
      validatePayerAllocation(10, [{ amount: 3.33 }, { amount: 6.67 }]),
    ).toEqual({
      valid: true,
      allocatedAmount: 10,
      difference: 0,
    });
    expect(validatePayerAllocation(10, [{ amount: 9.99 }]).valid).toBe(false);
    expect(
      validatePayerAllocation(10, [{ amount: 0 }, { amount: 10 }]).valid,
    ).toBe(false);
  });
});
