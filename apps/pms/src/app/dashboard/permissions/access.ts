import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type PermissionsAccess = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function getPermissionsAccess(user: UserLike): PermissionsAccess {
  const permissions = user?.permissions || [];

  return {
    canCreate: permissions.includes(PERMISSIONS.PERMISSION_CREATE),
    canRead: permissions.includes(PERMISSIONS.PERMISSION_READ),
    canUpdate: permissions.includes(PERMISSIONS.PERMISSION_UPDATE),
    canDelete: permissions.includes(PERMISSIONS.PERMISSION_DELETE)
  };
}

export function getPermissionsDefaultRoute(access: PermissionsAccess): "/dashboard/permissions/view" | "/dashboard/permissions/create" | null {
  if (access.canRead) {
    return "/dashboard/permissions/view";
  }

  if (access.canCreate) {
    return "/dashboard/permissions/create";
  }

  return null;
}
