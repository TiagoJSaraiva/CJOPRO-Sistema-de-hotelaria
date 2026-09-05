import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type AdminPartnerSettlement,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../../src/auth/session";
import type { ConsumptionManagementRepository } from "../../../src/repositories/consumptionManagementRepository";
import { registerConsumptionManagementRoutes } from "../../../src/routes/consumptionManagementRoutes";

const hotelId = "10000000-0000-4000-8000-000000000001";
const actorId = "80000000-0000-4000-8000-000000000002";
const partnerId = "b0000000-0000-4000-8000-000000000001";
const settlementId = "b7000000-0000-4000-8000-000000000001";
const apps: ReturnType<typeof Fastify>[] = [];

function token(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  return signToken({
    id: actorId,
    name: "Gerente",
    email: "gerente@example.com",
    tenantId: null,
    roles: ["Gerente"],
    permissions,
    roleAssignments: [
      {
        roleId: "role",
        roleName: "Gerente",
        roleType: "HOTEL_ROLE",
        hotelId,
        hotelName: "Hotel",
      },
    ] as SessionPayload["roleAssignments"],
    iat: now,
    exp: now + 3600,
  });
}
function headers(permissions: string[], activeHotel = hotelId) {
  return {
    authorization: `Bearer ${token(permissions)}`,
    [ACTIVE_HOTEL_HEADER_NAME]: activeHotel,
  };
}
const settlement = {
  id: settlementId,
  hotel_id: hotelId,
  partner: {
    id: partnerId,
    trade_name: "Spa Azul",
    is_active: true,
    archived_at: null,
  },
  period_start: "2026-08-01",
  period_end: "2026-08-31",
  currency: "BRL",
  status: "draft",
  direction: "hotel_to_partner",
  version: 1,
  gross_sales: 100,
  discount_total: 0,
  courtesy_total: 0,
  reversal_total: 0,
  operational_net: 100,
  hotel_collected: 100,
  partner_direct: 0,
  rent_total: 0,
  commission_total: 20,
  minimum_guarantee_topup: 0,
  contribution_total: 20,
  net_settlement: 80,
  due_on: "2026-09-05",
  prepared_by: actorId,
  prepared_at: new Date().toISOString(),
  submitted_by: null,
  submitted_at: null,
  approved_by: null,
  approved_at: null,
  settled_by: null,
  settled_at: null,
  statement_snapshot: null,
  components: [],
  sources: [],
  payments: [],
  events: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as AdminPartnerSettlement;

function repository(): ConsumptionManagementRepository {
  return {
    getSettings: vi.fn(async () => ({
      hotel_id: hotelId,
      settlement_tracking_starts_on: "2026-08-01",
      payment_due_days: 5,
      agreement_expiry_alert_days: 30,
      guest_balance_alert_days: 0,
      last_changed_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    updateSettings: vi.fn(async () => null),
    getAnalytics: vi.fn(async () => ({
      result: "ok",
      item: {
        summary: {
          gross_sales: 100,
          discount_total: 0,
          courtesy_total: 0,
          reversal_total: 0,
          operational_net: 100,
          hotel_collected: 100,
          partner_direct: 0,
          order_count: 1,
          legacy_count: 0,
        },
        series: [],
        rows: [],
        total: 0,
        next_cursor: null,
      },
    })),
    getAlerts: vi.fn(async () => ({
      result: "ok",
      item: {
        guest_balances: [
          {
            id: "guest",
            kind: "guest_balance",
            severity: "warning",
            title: "Saldo pendente",
            description: "Quarto 101",
            href: "/dashboard/reservations/account",
            entity_id: settlementId,
            guest_name: "Pessoa protegida",
          },
        ],
        critical_stock: [],
        expiring_agreements: [],
        pending_settlements: [],
      },
    })),
    listCandidates: vi.fn(async () => []),
    listSettlements: vi.fn(async () => ({
      items: [settlement],
      nextCursor: null,
    })),
    getSettlement: vi.fn(async (id, scopedHotelId) =>
      id === settlementId && scopedHotelId === hotelId ? settlement : null,
    ),
    refreshSettlement: vi.fn(async () => ({
      result: "ok",
      id: settlementId,
      created: true,
    })),
    submitSettlement: vi.fn(async () => ({
      result: "ok",
      id: settlementId,
      version: 2,
    })),
    decideSettlement: vi.fn(async () => ({
      result: "ok",
      id: settlementId,
      version: 3,
    })),
    paySettlement: vi.fn(async () => ({
      result: "ok",
      id: settlementId,
      version: 4,
    })),
    reversePayment: vi.fn(async () => ({
      result: "ok",
      id: "payment",
      settlementId,
    })),
  };
}
async function appWith(repo: ConsumptionManagementRepository) {
  const app = Fastify();
  registerConsumptionManagementRoutes(app, repo);
  await app.ready();
  apps.push(app);
  return app;
}
afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

describe("consumption management routes", () => {
  it("requires authentication, independent permissions and active hotel scope", async () => {
    const app = await appWith(repository());
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/consumption-analytics?from=2026-08-01&to=2026-08-31",
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/consumption-analytics?from=2026-08-01&to=2026-08-31",
          headers: headers([PERMISSIONS.CONSUMPTION_READ]),
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/consumption-analytics?from=2026-08-01&to=2026-08-31",
          headers: headers([PERMISSIONS.CONSUMPTION_ANALYTICS_READ]),
        })
      ).statusCode,
    ).toBe(200);
  });

  it("validates analytics filters and scopes the full query to the active hotel", async () => {
    const repo = repository();
    const app = await appWith(repo);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/consumption-analytics?from=bad&to=2026-08-31",
          headers: headers([PERMISSIONS.CONSUMPTION_ANALYTICS_READ]),
        })
      ).statusCode,
    ).toBe(400);
    const response = await app.inject({
      method: "GET",
      url: "/admin/consumption-analytics?from=2026-08-01&to=2026-08-31&dimension=partner&limit=200",
      headers: headers([PERMISSIONS.CONSUMPTION_ANALYTICS_READ]),
    });
    expect(response.statusCode).toBe(200);
    expect(repo.getAnalytics).toHaveBeenCalledWith(
      hotelId,
      expect.objectContaining({ dimension: "partner", limit: 50 }),
    );
  });

  it("redacts guest names without calendar permission", async () => {
    const app = await appWith(repository());
    const hidden = await app.inject({
      method: "GET",
      url: "/admin/management-alerts",
      headers: headers([PERMISSIONS.CONSUMPTION_ANALYTICS_READ]),
    });
    expect(hidden.json().item.guest_balances[0].guest_name).toBeNull();
    const visible = await app.inject({
      method: "GET",
      url: "/admin/management-alerts",
      headers: headers([PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS]),
    });
    expect(visible.json().item.guest_balances[0].guest_name).toBe(
      "Pessoa protegida",
    );
  });

  it("enforces prepare, approve and settle permissions independently", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const createPayload = { partner_id: partnerId, period_start: "2026-08-01" };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/admin/partner-settlements",
          headers: headers([PERMISSIONS.PARTNER_SETTLEMENTS_READ]),
          payload: createPayload,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/admin/partner-settlements",
          headers: headers([PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE]),
          payload: createPayload,
        })
      ).statusCode,
    ).toBe(201);
    vi.mocked(repo.refreshSettlement).mockResolvedValueOnce({
      result: "settlement_already_exists",
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/admin/partner-settlements",
      headers: headers([PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE]),
      payload: createPayload,
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().details).toBe("settlement_already_exists");
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/partner-settlements/${settlementId}/decision`,
          headers: headers([PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE]),
          payload: { expected_version: 1, decision: "approve" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/partner-settlements/${settlementId}/decision`,
          headers: headers([PERMISSIONS.PARTNER_SETTLEMENTS_APPROVE]),
          payload: { expected_version: 1, decision: "approve" },
        })
      ).statusCode,
    ).toBe(200);
    expect(repo.decideSettlement).toHaveBeenCalledWith(
      hotelId,
      settlementId,
      actorId,
      expect.objectContaining({ decision: "approve" }),
    );
  });

  it("returns stable conflicts and does not reveal another hotel's settlement", async () => {
    const repo = repository();
    vi.mocked(repo.submitSettlement).mockResolvedValueOnce({
      result: "settlement_sources_changed",
    });
    const app = await appWith(repo);
    const conflict = await app.inject({
      method: "POST",
      url: `/admin/partner-settlements/${settlementId}/submit`,
      headers: headers([PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE]),
      payload: { expected_version: 1 },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().details).toBe("settlement_sources_changed");
    const foreign = await app.inject({
      method: "GET",
      url: `/admin/partner-settlements/${settlementId}`,
      headers: headers(
        [PERMISSIONS.PARTNER_SETTLEMENTS_READ],
        "10000000-0000-4000-8000-000000000099",
      ),
    });
    expect([403, 404]).toContain(foreign.statusCode);
  });
});
