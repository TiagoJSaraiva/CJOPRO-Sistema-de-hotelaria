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
      canReadCommercial: false,
      canManagePartners: false,
      canManageAgreements: false,
      canPost: false,
      canReceivePayment: false,
      canGrantCourtesy: false,
    });
    expect(
      getConsumptionAccess({
        permissions: [PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE],
      }),
    ).toEqual({
      canRead: false,
      canManage: true,
      canReadCommercial: false,
      canManagePartners: false,
      canManageAgreements: false,
      canPost: false,
      canReceivePayment: false,
      canGrantCourtesy: false,
    });
  });

  it("routes only readers into the module", () => {
    expect(
      getConsumptionDefaultRoute({
        canRead: true,
        canManage: false,
        canReadCommercial: false,
        canManagePartners: false,
        canManageAgreements: false,
        canPost: false,
        canReceivePayment: false,
        canGrantCourtesy: false,
      }),
    ).toBe("/dashboard/consumption/points");
    expect(
      getConsumptionDefaultRoute({
        canRead: false,
        canManage: true,
        canReadCommercial: false,
        canManagePartners: false,
        canManageAgreements: false,
        canPost: false,
        canReceivePayment: false,
        canGrantCourtesy: false,
      }),
    ).toBeNull();
    expect(
      getConsumptionDefaultRoute({
        canRead: false,
        canManage: false,
        canReadCommercial: true,
        canManagePartners: false,
        canManageAgreements: false,
        canPost: false,
        canReceivePayment: false,
        canGrantCourtesy: false,
      }),
    ).toBe("/dashboard/consumption/partners");
  });

  it("separates partner and agreement management permissions", () => {
    expect(
      getConsumptionAccess({
        permissions: [
          PERMISSIONS.COMMERCIAL_PARTNERS_READ,
          PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
        ],
      }),
    ).toMatchObject({
      canReadCommercial: true,
      canManagePartners: false,
      canManageAgreements: true,
    });
  });

  it("prioritizes the operational launch for authorized operators", () => {
    const access = getConsumptionAccess({
      permissions: [
        PERMISSIONS.CONSUMPTION_POST,
        PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE,
        PERMISSIONS.CONSUMPTION_COURTESY_GRANT,
      ],
    });
    expect(access).toMatchObject({
      canPost: true,
      canReceivePayment: true,
      canGrantCourtesy: true,
    });
    expect(getConsumptionDefaultRoute(access)).toBe(
      "/dashboard/consumption/launch",
    );
  });
});
