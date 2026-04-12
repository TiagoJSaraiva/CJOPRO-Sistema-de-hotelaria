import { PERMISSIONS, type AuthUser, type PermissionName } from "@hotel/shared";
import { normalizeOptionalText } from "../common/text";

export function mapAuthUserFromDb(item: any): AuthUser {
  const roleNames = new Set<string>();
  const permissionNames = new Set<PermissionName>();
  const validPermissions = new Set<PermissionName>(Object.values(PERMISSIONS));
  const roleAssignments: AuthUser["roleAssignments"] = [];

  if (Array.isArray(item.user_roles)) {
    for (const row of item.user_roles) {
      const roleId = normalizeOptionalText(row?.roles?.id);
      const roleName = normalizeOptionalText(row?.roles?.name);
      const roleHotelId = normalizeOptionalText(row?.roles?.hotel_id || row?.hotel_id || null);
      const roleHotelName = normalizeOptionalText(row?.roles?.hotels?.name);

      if (roleId && roleName) {
        roleAssignments.push({
          roleId,
          roleName,
          hotelId: roleHotelId,
          hotelName: roleHotelName
        });
      }

      if (roleName) {
        roleNames.add(roleName);
      }

      const rolePermissions = row?.roles?.role_permissions;

      if (!Array.isArray(rolePermissions)) {
        continue;
      }

      for (const permissionRow of rolePermissions) {
        const permissionName = normalizeOptionalText(permissionRow?.permissions?.name);

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

    if (!roleId || seen.has(roleId)) {
      continue;
    }

    const hotelId = normalizeOptionalText((item as { hotel_id?: string | null })?.hotel_id || null);

    normalized.push({ role_id: roleId, hotel_id: hotelId });
    seen.add(roleId);
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

export function mapRoleOption(item: any): { id: string; name: string; hotel_id: string | null; hotel_name: string | null } {
  return {
    id: item.id,
    name: item.name,
    hotel_id: item.hotel_id || null,
    hotel_name: item.hotels?.name || null
  };
}

export function mapAdminUser(item: any): {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
  role_assignments: Array<{ role_id: string; role_name: string; hotel_id: string | null; hotel_name: string | null }>;
} {
  const roleAssignments = Array.isArray(item.user_roles)
    ? item.user_roles
        .map((row: any) => {
          const role = row.roles;

          if (!role?.id) {
            return null;
          }

          return {
            role_id: role.id,
            role_name: role.name,
            hotel_id: role.hotel_id || null,
            hotel_name: role.hotels?.name || null
          };
        })
        .filter(Boolean)
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

export function mapAdminRole(item: any): {
  id: string;
  name: string;
  hotel_id: string | null;
  hotel_name: string | null;
  permissions: Array<{ id: string; name: string }>;
} {
  const permissions = Array.isArray(item.role_permissions)
    ? item.role_permissions
        .map((row: any) => row.permissions)
        .filter((permission: any) => !!permission?.id)
        .map((permission: any) => ({ id: permission.id, name: permission.name }))
    : [];

  return {
    id: item.id,
    name: item.name,
    hotel_id: item.hotel_id || null,
    hotel_name: item.hotels?.name || null,
    permissions
  };
}
