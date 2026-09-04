import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type AdminConsumptionOperationalContext,
  type AdminConsumptionOrder,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../../src/auth/session";
import type { ConsumptionOrdersRepository } from "../../../src/repositories/consumptionOrdersRepository";
import { registerConsumptionOrderRoutes } from "../../../src/routes/consumptionOrderRoutes";

const hotelId = "10000000-0000-4000-8000-000000000001";
const stayId = "91000000-0000-4000-8000-000000000002";
const pointId = "a1000000-0000-4000-8000-000000000001";
const offerId = "a2000000-0000-4000-8000-000000000001";
const now = "2026-09-04T15:00:00.000Z";
const apps: ReturnType<typeof Fastify>[] = [];

const context: AdminConsumptionOperationalContext = {
  stay: {
    id: stayId,
    reservation_id: "90000000-0000-4000-8000-000000000002",
    reservation_code: "AUR-2",
    room_id: "20000000-0000-4000-8000-000000000102",
    room_number: "102",
    room_type: "Luxo",
    primary_guest_name: "Ana",
    checkin_date_actual: "2026-09-03T14:00:00.000Z",
    checkout_date_expected: "2026-09-05T11:00:00.000Z",
    stay_status: "checked_in",
  },
  guests: [],
  offers: [],
  occurred_at: now,
};
const order: AdminConsumptionOrder = {
  id: "c2000000-0000-4000-8000-000000000001",
  hotel_id: hotelId,
  stay_id: stayId,
  reservation_id: context.stay.reservation_id,
  point_id: pointId,
  guest_customer_id: null,
  disposition: "charged",
  billing_mode: "stay_folio",
  payment_method: null,
  payment_reference: null,
  partner_receipt_confirmed: false,
  currency: "BRL",
  gross_amount: 16,
  discount_amount: 0,
  net_amount: 16,
  reservation_code: "AUR-2",
  room_number: "102",
  guest_name: "Ana",
  point_name: "Recepção",
  notes: null,
  courtesy_reason: null,
  occurred_at: now,
  posted_at: now,
  posted_by: "80000000-0000-4000-8000-000000000002",
  operator_name: "Gerente",
  is_legacy: false,
  items: [],
};

function token(permissions: string[], scopedHotelId: string | null = hotelId) {
  const issuedAt = Math.floor(Date.now() / 1000);
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
        roleType: scopedHotelId ? "HOTEL_ROLE" : "SYSTEM_ROLE",
        hotelId: scopedHotelId,
        hotelName: "Hotel",
      },
    ] as SessionPayload["roleAssignments"],
    iat: issuedAt,
    exp: issuedAt + 3600,
  });
}

function headers(permissions: string[]) {
  return {
    authorization: `Bearer ${token(permissions)}`,
    [ACTIVE_HOTEL_HEADER_NAME]: hotelId,
  };
}

function repository(): ConsumptionOrdersRepository {
  return {
    listEligibleStays: vi.fn(async () => []),
    getContext: vi.fn(async () => ({ result: "ok", item: context })),
    post: vi.fn(async () => ({ result: "ok", item: order, created: true })),
    list: vi.fn(async () => ({ items: [order], next_cursor: null })),
    get: vi.fn(async () => order),
  };
}

async function appWith(repo: ConsumptionOrdersRepository) {
  const app = Fastify();
  registerConsumptionOrderRoutes(app, repo);
  await app.ready();
  apps.push(app);
  return app;
}

afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

describe("consumption operation routes", () => {
  it("requires authentication and the operational permission", async () => {
    const app = await appWith(repository());
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/consumption-orders/eligible-stays",
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/consumption-orders/eligible-stays",
          headers: headers([PERMISSIONS.CONSUMPTION_READ]),
        })
      ).statusCode,
    ).toBe(403);
  });

  it("loads context only through the active hotel", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "GET",
      url: `/admin/consumption-orders/context?stay_id=${stayId}&occurred_at=${encodeURIComponent(now)}`,
      headers: headers([PERMISSIONS.CONSUMPTION_POST]),
    });
    expect(response.statusCode).toBe(200);
    expect(repo.getContext).toHaveBeenCalledWith(hotelId, stayId, now);
  });

  it("preserves the public reason when the operational context is stale", async () => {
    const repo = repository();
    vi.mocked(repo.getContext).mockResolvedValue({
      result: "stay_not_checked_in",
    });
    const app = await appWith(repo);
    const response = await app.inject({
      method: "GET",
      url: `/admin/consumption-orders/context?stay_id=${stayId}&occurred_at=${encodeURIComponent(now)}`,
      headers: headers([PERMISSIONS.CONSUMPTION_POST]),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().details).toBe("stay_not_checked_in");
  });

  it("requires the financial permission for immediate payment", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "POST",
      url: "/admin/consumption-orders",
      headers: headers([PERMISSIONS.CONSUMPTION_POST]),
      payload: {
        stay_id: stayId,
        point_id: pointId,
        occurred_at: now,
        disposition: "charged",
        billing_mode: "hotel_immediate",
        payment_method: "pix",
        idempotency_key: "c1000000-0000-4000-8000-000000000001",
        lines: [{ offer_id: offerId, quantity: 1, version_token: "v1" }],
      },
    });
    expect(response.statusCode).toBe(403);
    expect(repo.post).not.toHaveBeenCalled();
  });

  it("requires courtesy permission and returns a complete receipt after posting", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const payload = {
      stay_id: stayId,
      point_id: pointId,
      occurred_at: now,
      disposition: "courtesy",
      courtesy_reason: "Falha de serviço",
      idempotency_key: "c1000000-0000-4000-8000-000000000002",
      lines: [{ offer_id: offerId, quantity: 1, version_token: "v1" }],
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/admin/consumption-orders",
          headers: headers([PERMISSIONS.CONSUMPTION_POST]),
          payload,
        })
      ).statusCode,
    ).toBe(403);
    const response = await app.inject({
      method: "POST",
      url: "/admin/consumption-orders",
      headers: headers([
        PERMISSIONS.CONSUMPTION_POST,
        PERMISSIONS.CONSUMPTION_COURTESY_GRANT,
      ]),
      payload,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().item.id).toBe(order.id);
  });

  it("maps concurrency and idempotency conflicts without exposing another hotel", async () => {
    const repo = repository();
    repo.post = vi.fn(async () => ({ result: "version_conflict" }));
    const app = await appWith(repo);
    const response = await app.inject({
      method: "POST",
      url: "/admin/consumption-orders",
      headers: headers([PERMISSIONS.CONSUMPTION_POST]),
      payload: {
        stay_id: stayId,
        point_id: pointId,
        occurred_at: now,
        disposition: "charged",
        billing_mode: "stay_folio",
        idempotency_key: "c1000000-0000-4000-8000-000000000003",
        lines: [{ offer_id: offerId, quantity: 1, version_token: "old" }],
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().details).toBe("version_conflict");
  });

  it("protects history with read_consumption and passes commercial visibility", async () => {
    const repo = repository();
    const app = await appWith(repo);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/consumption-orders",
          headers: headers([PERMISSIONS.CONSUMPTION_POST]),
        })
      ).statusCode,
    ).toBe(403);
    const response = await app.inject({
      method: "GET",
      url: `/admin/consumption-orders/${order.id}`,
      headers: headers([
        PERMISSIONS.CONSUMPTION_READ,
        PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
      ]),
    });
    expect(response.statusCode).toBe(200);
    expect(repo.get).toHaveBeenCalledWith(hotelId, order.id, true);
  });
});
