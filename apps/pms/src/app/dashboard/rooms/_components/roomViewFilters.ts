import type { AdminRoom, RoomStatus } from "@hotel/shared";

export type RoomViewFilters = {
  search: string;
  status: "all" | RoomStatus;
  minOccupancy: string;
  maxOccupancy: string;
};

export const DEFAULT_ROOM_VIEW_FILTERS: RoomViewFilters = {
  search: "",
  status: "all",
  minOccupancy: "",
  maxOccupancy: ""
};

export function countAppliedRoomFilters(filters: RoomViewFilters): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.status !== "all") total += 1;
  if (filters.minOccupancy.trim()) total += 1;
  if (filters.maxOccupancy.trim()) total += 1;

  return total;
}

export function applyRoomViewFilters(rooms: AdminRoom[], filters: RoomViewFilters): AdminRoom[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const minOccupancy = Number(filters.minOccupancy || "");
  const maxOccupancy = Number(filters.maxOccupancy || "");

  return rooms.filter((room) => {
    if (search) {
      const haystack = `${room.room_number} ${room.room_type} ${room.notes || ""}`.toLocaleLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (filters.status !== "all" && room.status !== filters.status) {
      return false;
    }

    if (filters.minOccupancy.trim() && (!Number.isFinite(minOccupancy) || room.max_occupancy < minOccupancy)) {
      return false;
    }

    if (filters.maxOccupancy.trim() && (!Number.isFinite(maxOccupancy) || room.max_occupancy > maxOccupancy)) {
      return false;
    }

    return true;
  });
}