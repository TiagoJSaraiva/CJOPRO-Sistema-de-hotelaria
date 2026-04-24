import { PERMISSIONS, type AuthUser } from "@hotel/shared";

type UserLike = Pick<AuthUser, "permissions"> | null;

export type ProductsAccess = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export function getProductsAccess(user: UserLike): ProductsAccess {
  const permissions = user?.permissions || [];
  return {
    canCreate: permissions.includes(PERMISSIONS.PRODUCT_CREATE),
    canRead: permissions.includes(PERMISSIONS.PRODUCT_READ),
    canUpdate: permissions.includes(PERMISSIONS.PRODUCT_UPDATE),
    canDelete: permissions.includes(PERMISSIONS.PRODUCT_DELETE)
  };
}
