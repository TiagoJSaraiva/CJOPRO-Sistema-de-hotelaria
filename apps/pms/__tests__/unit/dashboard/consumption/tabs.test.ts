import { describe, expect, it } from "vitest";
import { getConsumptionAccess } from "../../../../src/app/dashboard/consumption/access";
import { consumptionTabs } from "../../../../src/app/dashboard/consumption/tabs";
import { PERMISSIONS } from "@hotel/shared";

describe("consumption management tabs", () => {
  it("shows analytics and settlements independently", () => {
    const analytics = consumptionTabs(
      getConsumptionAccess({
        permissions: [PERMISSIONS.CONSUMPTION_ANALYTICS_READ],
      }),
    );
    expect(analytics.find((tab) => tab.key === "analytics")?.isVisible).toBe(
      true,
    );
    expect(analytics.find((tab) => tab.key === "settlements")?.isVisible).toBe(
      false,
    );
    const finance = consumptionTabs(
      getConsumptionAccess({
        permissions: [PERMISSIONS.PARTNER_SETTLEMENTS_SETTLE],
      }),
    );
    expect(finance.find((tab) => tab.key === "settlements")?.isVisible).toBe(
      true,
    );
    expect(finance.find((tab) => tab.key === "analytics")?.isVisible).toBe(
      false,
    );
  });
});
