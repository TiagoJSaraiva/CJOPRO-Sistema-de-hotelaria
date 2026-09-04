import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@hotel/shared";
import {
  getConsumptionAccess,
  getConsumptionDefaultRoute,
} from "../../../../src/app/dashboard/consumption/access";

describe("consumption access", () => {
  it("separates reading from configuration management", () => {
    expect(
      getConsumptionAccess({ permissions: [PERMISSIONS.CONSUMPTION_READ] }),
    ).toEqual({
      canRead: true,
      canManage: false,
    });
    expect(
      getConsumptionAccess({
        permissions: [PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE],
      }),
    ).toEqual({
      canRead: false,
      canManage: true,
    });
  });

  it("routes only readers into the module", () => {
    expect(
      getConsumptionDefaultRoute({ canRead: true, canManage: false }),
    ).toBe("/dashboard/consumption/points");
    expect(
      getConsumptionDefaultRoute({ canRead: false, canManage: true }),
    ).toBeNull();
  });
});
