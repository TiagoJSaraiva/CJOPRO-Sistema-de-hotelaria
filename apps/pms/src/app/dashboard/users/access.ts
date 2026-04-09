import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type UsersAccess = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function getUsersAccess(user: UserLike): UsersAccess {
  const permissions = user?.permissions || [];

  return {
    canCreate: permissions.includes(PERMISSIONS.USER_CREATE),
    canRead: permissions.includes(PERMISSIONS.USER_READ),
    canUpdate: permissions.includes(PERMISSIONS.USER_UPDATE),
    canDelete: permissions.includes(PERMISSIONS.USER_DELETE)
  };
}

export function getUsersDefaultRoute(access: UsersAccess): "/dashboard/users/view" | "/dashboard/users/create" | null {
  if (access.canRead) {
    return "/dashboard/users/view";
  }

  if (access.canCreate) {
    return "/dashboard/users/create";
  }

  return null;
}
