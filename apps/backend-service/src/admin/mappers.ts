import { PERMISSIONS, type AuthUser, type PermissionName } from "@hotel/shared";
import { normalizeOptionalText } from "../common/text";

type DbPermissionRow = {
  id?: string | null;
  name?: string | null;
  type?: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" | null;
};

type DbRolePermissionRow = {
  permissions?: DbPermissionRow | DbPermissionRow[] | null;
};

type DbHotelRow = {
  name?: string | null;
};

type DbRoleRow = {
  id?: string | null;
  name?: string | null;
  role_type?: "SYSTEM_ROLE" | "HOTEL_ROLE" | null;
  hotel_id?: string | null;
  hotels?: DbHotelRow | DbHotelRow[] | null;
  role_permissions?: DbRolePermissionRow[] | null;
};

type DbUserRoleAssignmentRow = {
  hotel_id?: string | null;
  hotels?: DbHotelRow | DbHotelRow[] | null;
  roles?: DbRoleRow | DbRoleRow[] | null;
};

type DbAuthUserRow = {
  id: string;
  name: string;
  email: string;
  user_roles?: DbUserRoleAssignmentRow[] | null;
};

type DbRoleOptionRow = {
  id: string;
  name: string;
  role_type?: "SYSTEM_ROLE" | "HOTEL_ROLE" | null;
  hotel_id?: string | null;
  hotels?: DbHotelRow | DbHotelRow[] | null;
};

type DbAdminUserRow = {
  id: string;
  name: string;
  email: string;
  is_active?: boolean | number | null;
  last_login_at?: string | null;
  created_at?: string | null;
  user_roles?: DbUserRoleAssignmentRow[] | null;
};

type DbAdminRoleRow = {
  id: string;
  name: string;
  role_type?: "SYSTEM_ROLE" | "HOTEL_ROLE" | null;
  hotel_id?: string | null;
  hotels?: DbHotelRow | DbHotelRow[] | null;
  role_permissions?: DbRolePermissionRow[] | null;
};

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function mapAuthUserFromDb(item: DbAuthUserRow): AuthUser {
  const roleNames = new Set<string>();
  const permissionNames = new Set<PermissionName>();
  const validPermissions = new Set<PermissionName>(Object.values(PERMISSIONS));
  const roleAssignments: AuthUser["roleAssignments"] = [];

  const collectRolePermissionNames = (rolePermissions: DbRolePermissionRow[] | null | undefined): string[] => {
    if (!Array.isArray(rolePermissions)) {
      return [];
    }

    const names = new Set<string>();

    for (const permissionRow of rolePermissions) {
      const permission = Array.isArray(permissionRow?.permissions) ? permissionRow.permissions[0] : permissionRow?.permissions;
      const permissionName = normalizeOptionalText(permission?.name);

      if (!permissionName) {
        continue;
      }

      names.add(permissionName);
    }

    return Array.from(names);
  };

  if (Array.isArray(item.user_roles)) {
    for (const row of item.user_roles) {
      const role = Array.isArray(row?.roles) ? row.roles[0] : row?.roles;
      const assignmentHotel = Array.isArray(row?.hotels) ? row.hotels[0] : row?.hotels;
      const roleHotel = Array.isArray(role?.hotels) ? role.hotels[0] : role?.hotels;
      const roleId = normalizeOptionalText(role?.id);
      const roleName = normalizeOptionalText(role?.name);
      const assignmentHotelId = normalizeOptionalText(row?.hotel_id || null);
      const assignmentHotelName = normalizeOptionalText(assignmentHotel?.name);
      const roleHotelId = normalizeOptionalText(role?.hotel_id || null);
      const roleHotelName = normalizeOptionalText(roleHotel?.name);
      const effectiveHotelId = assignmentHotelId || roleHotelId;
      const effectiveHotelName = assignmentHotelName || roleHotelName;
      const rolePermissions = role?.role_permissions;
      const assignmentPermissions = collectRolePermissionNames(rolePermissions);

      if (roleId && roleName) {
        roleAssignments.push({
          roleId,
          roleName,
          roleType: role?.role_type === "HOTEL_ROLE" ? "HOTEL_ROLE" : "SYSTEM_ROLE",
          hotelId: effectiveHotelId,
          hotelName: effectiveHotelName,
          permissions: assignmentPermissions
        });
      }

      if (roleName) {
        roleNames.add(roleName);
      }

      if (!Array.isArray(rolePermissions)) {
        continue;
      }

      for (const permissionRow of rolePermissions) {
        const permission = Array.isArray(permissionRow?.permissions) ? permissionRow.permissions[0] : permissionRow?.permissions;
        const permissionName = normalizeOptionalText(permission?.name);

        if (!permissionName) {
          continue;
        }

        if (validPermissions.has(permissionName as PermissionName)) {
          permissionNames.add(permissionName as PermissionName);
        }
      }
    }
  }

  return {
    id: item.id,
    name: item.name,
    email: item.email,
    tenantId: null,
    roles: Array.from(roleNames),
    permissions: Array.from(permissionNames),
    roleAssignments
  };
}

export function normalizeRoleAssignments(value: unknown): Array<{ role_id: string; hotel_id: string | null }> {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: Array<{ role_id: string; hotel_id: string | null }> = [];
  const seen = new Set<string>();

  for (const item of value) {
    const roleId = normalizeOptionalText((item as { role_id?: string })?.role_id);

    const hotelId = normalizeOptionalText((item as { hotel_id?: string | null })?.hotel_id || null);
    const dedupeKey = `${roleId || ""}::${hotelId || "__null__"}`;

    if (!roleId || seen.has(dedupeKey)) {
      continue;
    }

    normalized.push({ role_id: roleId, hotel_id: hotelId });
    seen.add(dedupeKey);
  }

  return normalized;
}

export function normalizePermissionIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    const id = normalizeOptionalText(String(item || ""));

    if (!id || seen.has(id)) {
      continue;
    }

    normalized.push(id);
    seen.add(id);
  }

  return normalized;
}

export function mapRoleOption(item: DbRoleOptionRow): {
  id: string;
  name: string;
  role_type: "SYSTEM_ROLE" | "HOTEL_ROLE";
  hotel_id: string | null;
  hotel_name: string | null;
} {
  const hotel = Array.isArray(item.hotels) ? item.hotels[0] : item.hotels;

  return {
    id: item.id,
    name: item.name,
    role_type: item.role_type === "HOTEL_ROLE" ? "HOTEL_ROLE" : "SYSTEM_ROLE",
    hotel_id: item.hotel_id || null,
    hotel_name: hotel?.name || null
  };
}

export function mapAdminUser(item: DbAdminUserRow): {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
  role_assignments: Array<{
    role_id: string;
    role_name: string;
    role_type: "SYSTEM_ROLE" | "HOTEL_ROLE";
    hotel_id: string | null;
    hotel_name: string | null;
    role_hotel_id: string | null;
    role_hotel_name: string | null;
  }>;
} {
  const roleAssignments = Array.isArray(item.user_roles)
    ? item.user_roles
        .map((row) => {
          const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
          const assignmentHotel = Array.isArray(row.hotels) ? row.hotels[0] : row.hotels;
          const roleHotel = Array.isArray(role?.hotels) ? role.hotels[0] : role?.hotels;

          if (!role?.id || !role.name) {
            return null;
          }

          return {
            role_id: role.id,
            role_name: role.name,
            role_type: (role.role_type === "HOTEL_ROLE" ? "HOTEL_ROLE" : "SYSTEM_ROLE") as "SYSTEM_ROLE" | "HOTEL_ROLE",
            hotel_id: row.hotel_id || null,
            hotel_name: assignmentHotel?.name || null,
            role_hotel_id: role.hotel_id || null,
            role_hotel_name: roleHotel?.name || null
          };
        })
        .filter(isDefined)
    : [];

  return {
    id: item.id,
    name: item.name,
    email: item.email,
    is_active: !!item.is_active,
    last_login_at: item.last_login_at || null,
    created_at: item.created_at || null,
    role_assignments: roleAssignments
  };
}

export function mapAdminRole(item: DbAdminRoleRow): {
  id: string;
  name: string;
  role_type: "SYSTEM_ROLE" | "HOTEL_ROLE";
  hotel_id: string | null;
  hotel_name: string | null;
  permissions: Array<{ id: string; name: string; type: "SYSTEM_PERMISSION" | "HOTEL_PERMISSION" }>;
} {
  const permissions = Array.isArray(item.role_permissions)
    ? item.role_permissions
        .map((row) => (Array.isArray(row.permissions) ? row.permissions[0] : row.permissions))
        .filter(
          (permission): permission is DbPermissionRow & { id: string } =>
            typeof permission?.id === "string" && permission.id.length > 0
        )
        .map((permission) => ({
          id: permission.id,
          name: permission.name || "",
          type: (permission.type === "HOTEL_PERMISSION" ? "HOTEL_PERMISSION" : "SYSTEM_PERMISSION") as
            | "SYSTEM_PERMISSION"
            | "HOTEL_PERMISSION"
        }))
    : [];

  const roleHotel = Array.isArray(item.hotels) ? item.hotels[0] : item.hotels;

  return {
    id: item.id,
    name: item.name,
    role_type: item.role_type === "HOTEL_ROLE" ? "HOTEL_ROLE" : "SYSTEM_ROLE",
    hotel_id: item.hotel_id || null,
    hotel_name: roleHotel?.name || null,
    permissions
  };
}
