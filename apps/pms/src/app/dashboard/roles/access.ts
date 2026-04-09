import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type RolesAccess = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function getRolesAccess(user: UserLike): RolesAccess {
  const permissions = user?.permissions || [];

  return {
    canCreate: permissions.includes(PERMISSIONS.ROLE_CREATE),
    canRead: permissions.includes(PERMISSIONS.ROLE_READ),
    canUpdate: permissions.includes(PERMISSIONS.ROLE_UPDATE),
    canDelete: permissions.includes(PERMISSIONS.ROLE_DELETE)
  };
}

export function getRolesDefaultRoute(access: RolesAccess): "/dashboard/roles/view" | "/dashboard/roles/create" | null {
  if (access.canRead) {
    return "/dashboard/roles/view";
  }

  if (access.canCreate) {
    return "/dashboard/roles/create";
  }

  return null;
}
