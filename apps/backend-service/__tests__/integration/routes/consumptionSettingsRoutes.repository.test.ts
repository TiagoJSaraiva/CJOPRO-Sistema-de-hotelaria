import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type AdminConsumptionOffer,
  type AdminConsumptionPoint,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../../src/auth/session";
import { registerConsumptionSettingsRoutes } from "../../../src/routes/consumptionSettingsRoutes";
import type { ConsumptionSettingsRepository } from "../../../src/repositories/consumptionSettingsRepository";

const apps: ReturnType<typeof Fastify>[] = [];
const point: AdminConsumptionPoint = {
  id: "a1000000-0000-4000-8000-000000000001",
  hotel_id: "10000000-0000-4000-8000-000000000001",
  name: "Frigobar",
  internal_code: "FRIGO",
  description: null,
  display_order: 10,
  is_active: true,
  default_policy: {
    allowed_modes: ["hotel_immediate", "stay_folio"],
    default_mode: "stay_folio",
  },
  offers_count: 1,
  inherited_offers_count: 1,
  archived_at: null,
};
const offer = {
  id: "a2000000-0000-4000-8000-000000000001",
  hotel_id: point.hotel_id,
  point: {
    id: point.id,
    name: point.name,
    internal_code: point.internal_code,
    is_active: true,
    archived_at: null,
    provider: { type: "hotel", partner: null },
  },
  product: {
    id: "40000000-0000-4000-8000-000000000001",
    hotel_id: point.hotel_id,
    name: "Água",
    category: {
      id: "41000000-0000-4000-8000-000000000001",
      hotel_id: point.hotel_id,
      name: "Frigobar",
      display_order: 0,
      is_active: true,
      archived_at: null,
    },
    description: null,
    internal_code: "AGUA",
    kind: "physical",
    sales_unit: "unit",
    unit_price: 8,
    status: "active",
    archived_at: null,
  },
  display_order: 10,
  is_active: true,
  policy: { source: "inherit" },
  resolved_policy: {
    source: "inherit",
    allowed_modes: ["hotel_immediate", "stay_folio"],
    default_mode: "stay_folio",
  },
  effective_available: true,
  unavailable_reasons: [],
  commercial_agreement: null,
  commercial_revision: null,
  archived_at: null,
} satisfies AdminConsumptionOffer;

function token(permissions: string[], hotelId: string | null = point.hotel_id) {
  const now = Math.floor(Date.now() / 1000);
  return signToken({
    id: "80000000-0000-4000-8000-000000000002",
    name: "Gerente",
    email: "gerente@example.com",
    tenantId: null,
    roles: ["Gerente"],
    permissions,
    roleAssignments: [
      {
        roleId: "role-1",
        roleName: "Gerente",
        roleType: hotelId ? "HOTEL_ROLE" : "SYSTEM_ROLE",
        hotelId,
        hotelName: "Hotel",
      },
    ] as SessionPayload["roleAssignments"],
    iat: now,
    exp: now + 3600,
  });
}

function repository(): ConsumptionSettingsRepository {
  return {
    listPoints: vi.fn(async () => [point]),
    createPoint: vi.fn(async () => ({ result: "ok", item: point })),
    updatePoint: vi.fn(async () => ({ result: "ok", item: point })),
    setPointArchived: vi.fn(async () => ({ result: "ok", item: point })),
    reorderPoints: vi.fn(async () => "ok"),
    listOffers: vi.fn(async () => [offer]),
    createOffers: vi.fn(async () => ({ result: "ok", items: [offer] })),
    updateOffer: vi.fn(async () => ({ result: "ok", item: offer })),
    setOfferArchived: vi.fn(async () => ({ result: "ok", item: offer })),
    reorderOffers: vi.fn(async () => "ok"),
    listHistory: vi.fn(async () => []),
  };
}

async function appWith(repo: ConsumptionSettingsRepository) {
  const app = Fastify();
  registerConsumptionSettingsRoutes(app, repo);
  await app.ready();
  apps.push(app);
  return app;
}

function headers(permissions: string[], hotelId = point.hotel_id) {
  return {
    authorization: `Bearer ${token(permissions)}`,
    [ACTIVE_HOTEL_HEADER_NAME]: hotelId,
  };
}

afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

describe("consumption settings routes", () => {
  it("requires authentication, read permission and an active hotel", async () => {
    const repo = repository();
    const app = await appWith(repo);
    expect(
      (await app.inject({ method: "GET", url: "/admin/consumption-points" }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/consumption-points",
          headers: {
            authorization: `Bearer ${token([PERMISSIONS.CONSUMPTION_READ], null)}`,
          },
        })
      ).statusCode,
    ).toBe(400);
    expect(repo.listPoints).not.toHaveBeenCalled();
  });

  it("lists only through the active hotel scope", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "GET",
      url: "/admin/consumption-points?include_archived=true",
      headers: headers([PERMISSIONS.CONSUMPTION_READ]),
    });
    expect(response.statusCode).toBe(200);
    expect(repo.listPoints).toHaveBeenCalledWith(point.hotel_id, true);
    const outside = await app.inject({
      method: "GET",
      url: "/admin/consumption-points",
      headers: headers(
        [PERMISSIONS.CONSUMPTION_READ],
        "10000000-0000-4000-8000-000000000002",
      ),
    });
    expect(outside.statusCode).toBe(403);
  });

  it("creates a point with a valid policy and dedicated permission", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "POST",
      url: "/admin/consumption-points",
      headers: headers([PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE]),
      payload: {
        name: "Frigobar",
        default_policy: {
          allowed_modes: ["hotel_immediate", "stay_folio"],
          default_mode: "stay_folio",
        },
      },
    });
    expect(response.statusCode).toBe(201);
    expect(repo.createPoint).toHaveBeenCalledWith(
      point.hotel_id,
      expect.any(String),
      expect.objectContaining({ name: "Frigobar" }),
    );
  });

  it("rejects empty, inconsistent and premature partner policies before repository access", async () => {
    const repo = repository();
    const app = await appWith(repo);
    for (const defaultPolicy of [
      { allowed_modes: [], default_mode: "stay_folio" },
      { allowed_modes: ["hotel_immediate"], default_mode: "stay_folio" },
      { allowed_modes: ["partner_direct"], default_mode: "partner_direct" },
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/admin/consumption-points",
        headers: headers([PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE]),
        payload: { name: "Ponto", default_policy: defaultPolicy },
      });
      expect(response.statusCode).toBe(400);
    }
    expect(repo.createPoint).not.toHaveBeenCalled();
  });

  it("creates an atomic product batch and returns conflicts", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "POST",
      url: `/admin/consumption-points/${point.id}/offers`,
      headers: headers([PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE]),
      payload: {
        product_ids: [offer.product.id],
        policy: { source: "inherit" },
      },
    });
    expect(response.statusCode).toBe(201);
    expect(repo.createOffers).toHaveBeenCalledWith(
      point.id,
      point.hotel_id,
      expect.any(String),
      {
        product_ids: [offer.product.id],
        policy: { source: "inherit" },
        commercial_agreement_id: null,
        inventory_location_id: null,
      },
    );
    vi.mocked(repo.createOffers).mockResolvedValueOnce({ result: "conflict" });
    const conflict = await app.inject({
      method: "POST",
      url: `/admin/consumption-points/${point.id}/offers`,
      headers: headers([PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE]),
      payload: {
        product_ids: [offer.product.id],
        policy: { source: "inherit" },
      },
    });
    expect(conflict.statusCode).toBe(409);
  });

  it("reorders, archives, restores and exposes history", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const manageHeaders = headers([PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE]);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/admin/consumption-points/order",
          headers: manageHeaders,
          payload: { ids: [point.id] },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/consumption-offers/${offer.id}/archive`,
          headers: manageHeaders,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/consumption-offers/${offer.id}/restore`,
          headers: manageHeaders,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/admin/consumption-offers/${offer.id}/history`,
          headers: headers([PERMISSIONS.CONSUMPTION_READ]),
        })
      ).statusCode,
    ).toBe(200);
    expect(repo.setOfferArchived).toHaveBeenNthCalledWith(
      1,
      offer.id,
      point.hotel_id,
      expect.any(String),
      true,
    );
    expect(repo.setOfferArchived).toHaveBeenNthCalledWith(
      2,
      offer.id,
      point.hotel_id,
      expect.any(String),
      false,
    );
  });
});
