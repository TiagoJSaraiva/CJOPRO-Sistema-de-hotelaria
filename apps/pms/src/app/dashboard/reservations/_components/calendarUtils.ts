import type { AdminReservationCalendarDay } from "@hotel/shared";

export const CALENDAR_WINDOW_DAYS = 20;

export function parseIsoDate(value: string): Date {
  const [yearRaw = "1970", monthRaw = "01", dayRaw = "01"] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDaysIso(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDateRangeLabel(
  days: AdminReservationCalendarDay[],
): string {
  if (!days.length) return "--";
  const start = days[0]?.date || "";
  const end = days[days.length - 1]?.date || "";
  const format = (date: string) => {
    const parsed = parseIsoDate(date);
    return `${String(parsed.getUTCDate()).padStart(2, "0")}/${String(parsed.getUTCMonth() + 1).padStart(2, "0")}/${parsed.getUTCFullYear()}`;
  };
  return `${format(start)} - ${format(end)}`;
}
