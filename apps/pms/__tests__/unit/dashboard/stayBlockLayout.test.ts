import { describe, expect, it } from "vitest";
import { computeStayBlockLayout } from "../../../src/app/dashboard/reservations_calendar/_components/stayBlockLayout";

describe("stay block layout", () => {
  const cellWidth = 44;

  it("calcula bloco inteiro sem meia-celula", () => {
    const layout = computeStayBlockLayout({
      startIndex: 2,
      endIndex: 4,
      startHalf: null,
      endHalf: null,
      cellWidth
    });
    expect(layout.left).toBe(88);
    expect(layout.width).toBe(132);
  });

  it("calcula bloco com meia-celula no inicio", () => {
    const layout = computeStayBlockLayout({
      startIndex: 2,
      endIndex: 4,
      startHalf: "right",
      endHalf: null,
      cellWidth
    });
    expect(layout.left).toBe(110);
    expect(layout.width).toBe(110);
  });

  it("calcula bloco com meia-celula no fim", () => {
    const layout = computeStayBlockLayout({
      startIndex: 2,
      endIndex: 4,
      startHalf: null,
      endHalf: "left",
      cellWidth
    });
    expect(layout.left).toBe(88);
    expect(layout.width).toBe(110);
  });

  it("calcula bloco com meia-celula em ambos lados", () => {
    const layout = computeStayBlockLayout({
      startIndex: 2,
      endIndex: 4,
      startHalf: "right",
      endHalf: "left",
      cellWidth
    });
    expect(layout.left).toBe(110);
    expect(layout.width).toBe(88);
  });

  it("respeita largura minima", () => {
    const layout = computeStayBlockLayout({
      startIndex: 2,
      endIndex: 1,
      startHalf: "right",
      endHalf: "left",
      cellWidth,
      minWidth: 8
    });
    expect(layout.width).toBeGreaterThanOrEqual(8);
  });
});
