import { describe, expect, it } from "vitest";
import {
  allocateFefo,
  approvalRequirement,
  availablePartnerBalance,
  cashDifference,
  classifyVariance,
  normalizeTaxId,
} from "../../src/operations-finance";

describe("operations and finance rules", () => {
  it("normalizes tax identifiers without merging empty values", () => {
    expect(normalizeTaxId("12.345.678/0001-90")).toBe("12345678000190");
    expect(normalizeTaxId("  ")).toBeNull();
  });

  it("selects configured approval tiers at their boundaries", () => {
    const tiers = [
      {
        minimumAmount: 0,
        maximumAmount: 1000,
        approvalsRequired: 1 as const,
        quotesRequired: 1,
      },
      {
        minimumAmount: 1000.01,
        maximumAmount: null,
        approvalsRequired: 2 as const,
        quotesRequired: 3,
      },
    ];
    expect(approvalRequirement(1000, tiers)?.approvalsRequired).toBe(1);
    expect(approvalRequirement(1000.01, tiers)?.approvalsRequired).toBe(2);
    expect(approvalRequirement(-1, tiers)).toBeNull();
  });

  it("uses the greater absolute or percentage tolerance", () => {
    expect(classifyVariance(100, 105, 3, 5).withinTolerance).toBe(true);
    expect(classifyVariance(100, 105.01, 3, 5).withinTolerance).toBe(false);
  });

  it("allocates FEFO with stable receipt and id tie breakers", () => {
    const result = allocateFefo(5, [
      {
        id: "late",
        available: 4,
        expiresOn: "2027-03-01",
        receivedAt: "2026-01-01",
      },
      {
        id: "first",
        available: 3,
        expiresOn: "2027-01-01",
        receivedAt: "2026-02-01",
      },
      {
        id: "second",
        available: 3,
        expiresOn: "2027-01-01",
        receivedAt: "2026-03-01",
      },
    ]);
    expect(result).toEqual({
      allocations: [
        { lotId: "first", quantity: 3 },
        { lotId: "second", quantity: 2 },
      ],
      remaining: 0,
    });
  });

  it("requires approval only outside cash tolerance", () => {
    expect(cashDifference(100, 100.05, 0.05).requiresApproval).toBe(false);
    expect(cashDifference(100, 99.94, 0.05).requiresApproval).toBe(true);
  });

  it("keeps disputed partner value outside the payable balance", () => {
    expect(availablePartnerBalance(1000, 250, 300)).toBe(450);
    expect(availablePartnerBalance(100, 80, 40)).toBe(0);
  });
});
