import type { AdminSeasonRoomRate } from "@hotel/shared";

export type SeasonRoomRateViewFilters = {
  search: string;
  seasonId: string;
  minRate: string;
  maxRate: string;
};

export const DEFAULT_SEASON_ROOM_RATE_VIEW_FILTERS: SeasonRoomRateViewFilters = {
  search: "",
  seasonId: "",
  minRate: "",
  maxRate: ""
};

export function countAppliedSeasonRoomRateFilters(filters: SeasonRoomRateViewFilters): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.seasonId.trim()) total += 1;
  if (filters.minRate.trim()) total += 1;
  if (filters.maxRate.trim()) total += 1;

  return total;
}

export function applySeasonRoomRateViewFilters(items: AdminSeasonRoomRate[], filters: SeasonRoomRateViewFilters): AdminSeasonRoomRate[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const seasonId = filters.seasonId.trim();
  const minRate = Number(filters.minRate || "");
  const maxRate = Number(filters.maxRate || "");

  return items.filter((item) => {
    if (search) {
      const haystack = `${item.room_type} ${item.season_id}`.toLocaleLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (seasonId && item.season_id !== seasonId) {
      return false;
    }

    if (filters.minRate.trim() && (!Number.isFinite(minRate) || item.daily_rate < minRate)) {
      return false;
    }

    if (filters.maxRate.trim() && (!Number.isFinite(maxRate) || item.daily_rate > maxRate)) {
      return false;
    }

    return true;
  });
}