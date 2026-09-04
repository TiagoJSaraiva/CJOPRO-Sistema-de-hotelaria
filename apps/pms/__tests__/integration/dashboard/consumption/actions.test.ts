import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePath: vi.fn(),
  getUser: vi.fn(),
  createPoint: vi.fn(),
  updatePoint: vi.fn(),
  archivePoint: vi.fn(),
  reorderPoints: vi.fn(),
  createOffers: vi.fn(),
  updateOffer: vi.fn(),
  archiveOffer: vi.fn(),
  reorderOffers: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: mocks.getUser,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  createConsumptionPoint: mocks.createPoint,
  updateConsumptionPoint: mocks.updatePoint,
  setConsumptionPointArchived: mocks.archivePoint,
  reorderConsumptionPoints: mocks.reorderPoints,
  createConsumptionOffers: mocks.createOffers,
  updateConsumptionOffer: mocks.updateOffer,
  setConsumptionOfferArchived: mocks.archiveOffer,
  reorderConsumptionOffers: mocks.reorderOffers,
}));

import {
  createConsumptionOffersAction,
  createConsumptionPointAction,
  updateConsumptionPointAction,
} from "../../../../src/app/dashboard/consumption/actions";

function pointForm() {
  const data = new FormData();
  data.set("name", "Frigobar");
  data.set("internal_code", "FRIGO");
  data.append("allowed_modes", "hotel_immediate");
  data.append("allowed_modes", "stay_folio");
  data.set("default_mode", "stay_folio");
  return data;
}

describe("dashboard/consumption/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE],
    });
  });

  it("creates a point with both supported billing modes", async () => {
    await expect(createConsumptionPointAction(pointForm())).rejects.toThrow(
      /^REDIRECT:\/dashboard\/consumption\/points\?status=created/,
    );
    expect(mocks.createPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Frigobar",
        default_policy: {
          allowed_modes: ["hotel_immediate", "stay_folio"],
          default_mode: "stay_folio",
        },
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/dashboard/products/view",
    );
  });

  it("updates the active state and complete point policy", async () => {
    const data = pointForm();
    data.set("id", "point-1");
    data.set("is_active", "on");
    await expect(updateConsumptionPointAction(data)).rejects.toThrow(
      /^REDIRECT:\/dashboard\/consumption\/points\?status=updated/,
    );
    expect(mocks.updatePoint).toHaveBeenCalledWith(
      "point-1",
      expect.objectContaining({
        is_active: true,
      }),
    );
  });

  it("creates inherited offers in one batch", async () => {
    const data = new FormData();
    data.set("point_id", "point-1");
    data.append("product_ids", "product-1");
    data.append("product_ids", "product-2");
    data.set("policy_source", "inherit");
    await expect(createConsumptionOffersAction(data)).rejects.toThrow(
      /^REDIRECT:\/dashboard\/consumption\/offers\?status=created/,
    );
    expect(mocks.createOffers).toHaveBeenCalledWith("point-1", {
      product_ids: ["product-1", "product-2"],
      policy: { source: "inherit" },
    });
  });

  it("rejects configuration without the dedicated permission", async () => {
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.CONSUMPTION_READ],
    });
    await expect(createConsumptionPointAction(pointForm())).rejects.toThrow(
      /^REDIRECT:\/dashboard\/consumption\/points\?status=forbidden/,
    );
    expect(mocks.createPoint).not.toHaveBeenCalled();
  });
});
