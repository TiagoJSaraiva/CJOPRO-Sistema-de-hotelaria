type HalfSide = "left" | "right" | null;

export type StayBlockLayoutInput = {
  startIndex: number;
  endIndex: number;
  startHalf: HalfSide;
  endHalf: HalfSide;
  cellWidth: number;
  minWidth?: number;
};

export type StayBlockLayout = {
  left: number;
  width: number;
};

export function computeStayBlockLayout({
  startIndex,
  endIndex,
  startHalf,
  endHalf,
  cellWidth,
  minWidth = 8
}: StayBlockLayoutInput): StayBlockLayout {
  const clampedEndIndex = Math.max(endIndex, startIndex);
  const halfCell = cellWidth / 2;

  const left = startIndex * cellWidth + (startHalf === "right" ? halfCell : 0);
  const fullSpanWidth = (clampedEndIndex - startIndex + 1) * cellWidth;
  const startHalfDiscount = startHalf === "right" ? halfCell : 0;
  const endHalfDiscount = endHalf === "left" ? halfCell : 0;
  const computedWidth = fullSpanWidth - startHalfDiscount - endHalfDiscount;

  return {
    left,
    width: Math.max(minWidth, computedWidth)
  };
}
