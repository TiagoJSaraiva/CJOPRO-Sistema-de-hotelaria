import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type CustomersAccess = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function getCustomersAccess(user: UserLike): CustomersAccess {
  const permissions = user?.permissions || [];

  return {
    canCreate: permissions.includes(PERMISSIONS.CUSTOMER_CREATE),
    canRead: permissions.includes(PERMISSIONS.CUSTOMER_READ),
    canUpdate: permissions.includes(PERMISSIONS.CUSTOMER_UPDATE),
    canDelete: permissions.includes(PERMISSIONS.CUSTOMER_DELETE)
  };
}

export function getCustomersDefaultRoute(access: CustomersAccess): "/dashboard/customers/view" | "/dashboard/customers/create" | null {
  if (access.canRead) {
    return "/dashboard/customers/view";
  }

  if (access.canCreate) {
    return "/dashboard/customers/create";
  }

  return null;
}
