import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@hotel/shared";
import { getInventoryAccess } from "../../../../src/app/dashboard/inventory/access";

describe("inventory access", () => {
  it("keeps quantity, cost, settings, movements and counts independent", () => {
    const access = getInventoryAccess({
      permissions: [
        PERMISSIONS.INVENTORY_READ,
        PERMISSIONS.INVENTORY_MOVEMENTS_POST,
      ],
    });
    expect(access).toEqual({
      canRead: true,
      canReadCosts: false,
      canManage: false,
      canPost: true,
      canCount: false,
    });
  });

  it("does not infer inventory access from product or consumption permissions", () => {
    expect(
      getInventoryAccess({
        permissions: [PERMISSIONS.PRODUCT_READ, PERMISSIONS.CONSUMPTION_POST],
      }),
    ).toEqual({
      canRead: false,
      canReadCosts: false,
      canManage: false,
      canPost: false,
      canCount: false,
    });
  });
});
