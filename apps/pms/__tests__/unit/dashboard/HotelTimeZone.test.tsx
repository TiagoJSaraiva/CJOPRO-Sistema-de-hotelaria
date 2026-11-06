// @vitest-environment jsdom
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  HotelInstant,
  HotelTimeZoneProvider,
  useHotelInputInstant,
} from "../../../src/app/dashboard/_components/HotelTimeZone";

afterEach(cleanup);

function inZone(timeZone: string | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <HotelTimeZoneProvider timeZone={timeZone}>
        {children}
      </HotelTimeZoneProvider>
    );
  };
}

describe("HotelInstant", () => {
  it("mostra o instante na hora do hotel ativo", () => {
    render(<HotelInstant value="2026-05-12T15:30:00.000Z" />, {
      wrapper: inZone("Asia/Tokyo"),
    });
    expect(screen.getByText("13/05/2026, 00:30:00")).toBeTruthy();
  });

  it("aceita formato parcial sem perder o fuso", () => {
    render(
      <HotelInstant
        value="2026-05-12T15:30:00.000Z"
        options={{ hour: "2-digit", minute: "2-digit" }}
      />,
      { wrapper: inZone("Asia/Tokyo") },
    );
    expect(screen.getByText("00:30")).toBeTruthy();
  });

  it("sem valor, mostra o texto alternativo", () => {
    render(<HotelInstant value={null} fallback="Não acompanhado" />, {
      wrapper: inZone("Asia/Tokyo"),
    });
    expect(screen.getByText("Não acompanhado")).toBeTruthy();
  });

  it("sem o relógio do hotel, não inventa uma hora em outro fuso", () => {
    render(<HotelInstant value="2026-05-12T15:30:00.000Z" />, {
      wrapper: inZone(null),
    });
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("instante inválido não vira data errada", () => {
    render(<HotelInstant value="não é data" />, {
      wrapper: inZone("Asia/Tokyo"),
    });
    expect(screen.getByText("—")).toBeTruthy();
  });
});

describe("useHotelInputInstant", () => {
  it("lê o campo na hora do hotel, não na do navegador", () => {
    const { result } = renderHook(() => useHotelInputInstant(), {
      wrapper: inZone("Asia/Tokyo"),
    });
    expect(result.current("2026-05-13T00:30")).toBe("2026-05-12T15:30:00.000Z");
  });

  it("recusa campo vazio ou data inexistente", () => {
    const { result } = renderHook(() => useHotelInputInstant(), {
      wrapper: inZone("Asia/Tokyo"),
    });
    expect(() => result.current("")).toThrow("Data e hora inválidas.");
    expect(() => result.current("2026-02-31T10:00")).toThrow(
      "Data e hora inválidas.",
    );
  });

  it("sem o relógio do hotel, recusa em vez de gravar em outro fuso", () => {
    const { result } = renderHook(() => useHotelInputInstant(), {
      wrapper: inZone(null),
    });
    expect(() => result.current("2026-05-13T00:30")).toThrow(
      "Data e hora inválidas.",
    );
  });
});
