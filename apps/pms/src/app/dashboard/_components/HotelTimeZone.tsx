"use client";

import {
  DEFAULT_DISPLAY_TIME_ZONE,
  formatHotelInstant,
  hotelLocalInputToInstant,
} from "@hotel/shared";
import { createContext, useContext, type ReactNode } from "react";

/** `null` significa que o relógio do hotel não pôde ser lido. */
const HotelTimeZoneContext = createContext<string | null>(
  DEFAULT_DISPLAY_TIME_ZONE,
);

export function HotelTimeZoneProvider({
  timeZone,
  children,
}: {
  timeZone: string | null;
  children: ReactNode;
}) {
  return (
    <HotelTimeZoneContext.Provider value={timeZone}>
      {children}
    </HotelTimeZoneContext.Provider>
  );
}

export function useHotelTimeZone(): string | null {
  return useContext(HotelTimeZoneContext);
}

/**
 * Mostra um instante na hora do hotel ativo. O mesmo texto sai no servidor e no navegador,
 * o que evita erro de hidratação quando os dois estão em fusos diferentes.
 */
export function HotelInstant({
  value,
  fallback = "—",
  options,
}: {
  value: string | null | undefined;
  fallback?: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const timeZone = useHotelTimeZone();
  if (!value) return fallback;
  return timeZone ? formatHotelInstant(value, timeZone, options) : "—";
}

/**
 * Converte o texto de um campo `datetime-local`, digitado na hora do hotel, em um instante.
 * `new Date(texto)` usaria o fuso do navegador de quem preenche.
 */
export function useHotelInputInstant() {
  const timeZone = useHotelTimeZone();
  return (value: FormDataEntryValue | null | undefined): string => {
    const instant = timeZone
      ? hotelLocalInputToInstant(String(value ?? ""), timeZone)
      : null;
    if (!instant) throw new Error("Data e hora inválidas.");
    return instant;
  };
}
