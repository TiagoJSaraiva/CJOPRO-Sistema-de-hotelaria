import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type TransactionsAccess = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function getTransactionsAccess(user: UserLike): TransactionsAccess {
  const permissions = user?.permissions || [];

  return {
    canCreate: permissions.includes(PERMISSIONS.TRANSACTION_CREATE),
    canRead: permissions.includes(PERMISSIONS.TRANSACTION_READ),
    canUpdate: permissions.includes(PERMISSIONS.TRANSACTION_UPDATE),
    canDelete: permissions.includes(PERMISSIONS.TRANSACTION_DELETE),
  };
}

export function getTransactionsDefaultRoute(
  access: TransactionsAccess,
): "/dashboard/transactions/view" | "/dashboard/transactions/create" | null {
  if (access.canRead) {
    return "/dashboard/transactions/view";
  }

  if (access.canCreate) {
    return "/dashboard/transactions/create";
  }

  return null;
}
