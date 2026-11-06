import { Type, type Static } from "typebox";

export const HotelClockSchema = Type.Object(
  {
    timezone: Type.String({ minLength: 1 }),
    operational_date: Type.String({ format: "date" }),
    operational_now: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false, $id: "HotelClock" },
);

export type HotelClock = Static<typeof HotelClockSchema>;

const LOCAL_INPUT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallClockIn(timeZone: string, instant: Date): WallClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function offsetInMilliseconds(timeZone: string, instant: Date): number {
  const wall = wallClockIn(timeZone, instant);
  const asUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function parseInstant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * Converte o texto de um campo `datetime-local`, digitado na hora do hotel, em um
 * instante. Devolve `null` para texto, data do calendário ou fuso inválidos.
 */
export function hotelLocalInputToInstant(
  text: string,
  timeZone: string,
): string | null {
  const match = LOCAL_INPUT_PATTERN.exec(text);
  if (!match) return null;

  const [year, month, day, hour, minute, second = 0] = match
    .slice(1)
    .map((part) => (part === undefined ? undefined : Number(part))) as [
    number,
    number,
    number,
    number,
    number,
    number | undefined,
  ];
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(wall);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute ||
    check.getUTCSeconds() !== second
  ) {
    return null;
  }

  try {
    // A segunda passada corrige a troca de deslocamento perto do horário de verão.
    const estimate = wall - offsetInMilliseconds(timeZone, check);
    const instant = wall - offsetInMilliseconds(timeZone, new Date(estimate));
    return new Date(instant).toISOString();
  } catch {
    return null;
  }
}

/** Formata um instante para um campo `datetime-local` na hora do hotel. */
export function instantToHotelLocalInput(
  value: string | null | undefined,
  timeZone: string,
): string {
  const instant = parseInstant(value);
  if (!instant) return "";

  try {
    const wall = wallClockIn(timeZone, instant);
    return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
  } catch {
    return "";
  }
}

/** Mostra um instante na hora do hotel, sem depender do fuso de quem renderiza. */
/** Fuso das telas de escopo global, sem hotel ativo: nunca o de quem renderiza. */
export const DEFAULT_DISPLAY_TIME_ZONE = "America/Sao_Paulo";

export function formatHotelInstant(
  value: string | null | undefined,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const instant = parseInstant(value);
  if (!instant) return "—";

  try {
    return instant.toLocaleString("pt-BR", { ...options, timeZone });
  } catch {
    return "—";
  }
}

/** Devolve o dia do hotel (`AAAA-MM-DD`) em que um instante aconteceu. */
export function instantToHotelDate(
  value: string | null | undefined,
  timeZone: string,
): string {
  return instantToHotelLocalInput(value, timeZone).slice(0, 10);
}
