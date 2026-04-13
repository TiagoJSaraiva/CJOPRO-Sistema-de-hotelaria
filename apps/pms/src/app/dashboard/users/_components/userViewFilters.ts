import type { AdminUser } from "@hotel/shared";

export type UserFilterStatus = "all" | "active" | "inactive";

export type UserViewFilters = {
  search: string;
  hotelId: string;
  roleId: string;
  status: UserFilterStatus;
  createdFrom: string;
  createdTo: string;
};

export const DEFAULT_USER_VIEW_FILTERS: UserViewFilters = {
  search: "",
  hotelId: "",
  roleId: "",
  status: "all",
  createdFrom: "",
  createdTo: ""
};

function parseDateStart(value: string): number | null {
  const raw = value.trim();

  if (!raw) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00`);
  const timestamp = date.getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
}

function parseDateEnd(value: string): number | null {
  const raw = value.trim();

  if (!raw) {
    return null;
  }

  const date = new Date(`${raw}T23:59:59.999`);
  const timestamp = date.getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
}

export function countAppliedUserFilters(filters: UserViewFilters): number {
  let total = 0;

  if (filters.search.trim()) total += 1;
  if (filters.hotelId.trim()) total += 1;
  if (filters.roleId.trim()) total += 1;
  if (filters.status !== "all") total += 1;
  if (filters.createdFrom.trim()) total += 1;
  if (filters.createdTo.trim()) total += 1;

  return total;
}

export function applyUserViewFilters(users: AdminUser[], filters: UserViewFilters): AdminUser[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const hotelId = filters.hotelId.trim();
  const roleId = filters.roleId.trim();
  const createdFrom = parseDateStart(filters.createdFrom);
  const createdTo = parseDateEnd(filters.createdTo);

  return users.filter((user) => {
    if (search) {
      const haystack = `${user.name} ${user.email}`.toLocaleLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (filters.status === "active" && !user.is_active) {
      return false;
    }

    if (filters.status === "inactive" && user.is_active) {
      return false;
    }

    const assignments = user.role_assignments || [];

    if (hotelId && roleId) {
      const matchesPair = assignments.some((assignment) => assignment.hotel_id === hotelId && assignment.role_id === roleId);

      if (!matchesPair) {
        return false;
      }
    } else {
      if (hotelId) {
        const matchesHotel = assignments.some((assignment) => assignment.hotel_id === hotelId);

        if (!matchesHotel) {
          return false;
        }
      }

      if (roleId) {
        const matchesRole = assignments.some((assignment) => assignment.role_id === roleId);

        if (!matchesRole) {
          return false;
        }
      }
    }

    if (createdFrom !== null || createdTo !== null) {
      const createdAtRaw = String(user.created_at || "").trim();

      if (!createdAtRaw) {
        return false;
      }

      const createdAt = new Date(createdAtRaw).getTime();

      if (Number.isNaN(createdAt)) {
        return false;
      }

      if (createdFrom !== null && createdAt < createdFrom) {
        return false;
      }

      if (createdTo !== null && createdAt > createdTo) {
        return false;
      }
    }

    return true;
  });
}
