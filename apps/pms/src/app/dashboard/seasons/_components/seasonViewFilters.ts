import type { AdminSeason } from "@hotel/shared";

export type SeasonViewFilters = {
  search: string;
  status: "all" | "active" | "inactive";
  startFrom: string;
  startTo: string;
};

export const DEFAULT_SEASON_VIEW_FILTERS: SeasonViewFilters = {
  search: "",
  status: "all",
  startFrom: "",
  startTo: "",
};

function parseDateStart(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const parts = raw.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  )
    return null;
  const timestamp = new Date(year, month - 1, day).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function parseDateEnd(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const parts = raw.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  )
    return null;
  const timestamp = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function countAppliedSeasonFilters(filters: SeasonViewFilters): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.status !== "all") total += 1;
  if (filters.startFrom.trim()) total += 1;
  if (filters.startTo.trim()) total += 1;

  return total;
}

export function applySeasonViewFilters(
  seasons: AdminSeason[],
  filters: SeasonViewFilters,
): AdminSeason[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const startFrom = parseDateStart(filters.startFrom);
  const startTo = parseDateEnd(filters.startTo);

  return seasons.filter((season) => {
    if (search && !season.name.toLocaleLowerCase().includes(search)) {
      return false;
    }

    if (filters.status === "active" && !season.is_active) {
      return false;
    }

    if (filters.status === "inactive" && season.is_active) {
      return false;
    }

    if (startFrom !== null || startTo !== null) {
      const startAt = new Date(`${season.start_date}T00:00:00`).getTime();

      if (Number.isNaN(startAt)) {
        return false;
      }

      if (startFrom !== null && startAt < startFrom) {
        return false;
      }

      if (startTo !== null && startAt > startTo) {
        return false;
      }
    }

    return true;
  });
}
