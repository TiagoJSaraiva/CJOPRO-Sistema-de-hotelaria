import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type AdminConsumptionCorrection,
  type AdminStayAccount,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../../src/auth/session";
import type { StayAccountsRepository } from "../../../src/repositories/stayAccountsRepository";
import { registerStayAccountRoutes } from "../../../src/routes/stayAccountRoutes";

const hotelId = "10000000-0000-4000-8000-000000000001";
const stayId = "91000000-0000-4000-8000-000000000002";
const orderId = "c2000000-0000-4000-8000-000000000001";
const correctionId = "d2000000-0000-4000-8000-000000000001";
const apps: ReturnType<typeof Fastify>[] = [];

const account = {
  stay_id: stayId,
  reservation_id: "90000000-0000-4000-8000-000000000002",
  reservation_code: "AUR-2",
  room_number: "102",
  guest_name: "Ana",
  stay_status: "checked_in",
  currency: "BRL",
  version: 4,
  status: "open",
  folio: {
    stay_id: stayId,
    currency: "BRL",
    entries: [],
    allocations: [],
    total_debits: 100,
    total_credits: 60,
    balance: 40,
    payment_status: "partial",
    pending_maintenance_entry_ids: [],
    checkout_balance: 40,
  },
  consumption_orders: [],
  corrections: [],
  payment_batches: [],
  refunds: [],
  checkout_record: null,
} as AdminStayAccount;

const correction = {
  id: correctionId,
  hotel_id: hotelId,
  order_id: orderId,
  stay_id: stayId,
  kind: "partial_adjustment",
  status: "pending",
  reason: "Item não consumido",
  account_version: 4,
  gross_reduction: 8,
  discount_increase: 0,
  net_reduction: 8,
  requested_by: "80000000-0000-4000-8000-000000000002",
  requested_at: new Date().toISOString(),
  decided_by: null,
  decided_at: null,
  decision_reason: null,
  completed_at: null,
  items: [],
} as AdminConsumptionCorrection;

function token(permissions: string[]) {
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
        roleType: "HOTEL_ROLE",
        hotelId,
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

function repository(): StayAccountsRepository {
  return {
    getAccount: vi.fn(async () => account),
    previewPaymentBatch: vi.fn(async () => ({
      currency: "BRL",
      balance: 40,
      total: 40,
      remaining: 0,
      allocations: [],
    })),
    createPaymentBatch: vi.fn(async () => ({ result: "ok", item: account })),
    requestCorrection: vi.fn(async () => ({ result: "ok", item: correction })),
    decideCorrection: vi.fn(async () => ({ result: "ok", item: correction })),
    confirmPartnerRefund: vi.fn(async () => ({
      result: "ok",
      item: correction,
    })),
    createRefund: vi.fn(async () => ({ result: "ok", item: account })),
    checkout: vi.fn(async () => ({ result: "ok", item: account })),
    listCorrections: vi.fn(async () => [correction]),
    getCorrection: vi.fn(async () => correction),
    getCheckoutRecord: vi.fn(async () => null),
  };
}

async function appWith(repo: StayAccountsRepository) {
  const app = Fastify();
  registerStayAccountRoutes(app, repo);
  await app.ready();
  apps.push(app);
  return app;
}

afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

describe("stay account routes", () => {
  it("requires authentication and reservation access for account reads", async () => {
    const app = await appWith(repository());
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/admin/stays/${stayId}/account`,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/admin/stays/${stayId}/account`,
          headers: headers([PERMISSIONS.CONSUMPTION_READ]),
        })
      ).statusCode,
    ).toBe(403);
  });

  it("scopes the account to the active hotel and protects commercial terms", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "GET",
      url: `/admin/stays/${stayId}/account`,
      headers: headers([
        PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS,
        PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
      ]),
    });
    expect(response.statusCode).toBe(200);
    expect(repo.getAccount).toHaveBeenCalledWith(hotelId, stayId, true);
  });

  it("rejects duplicate tenders and maps account version conflicts", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const payload = {
      tenders: [
        { payment_method: "pix" as const, amount: 20 },
        { payment_method: "pix" as const, amount: 20 },
      ],
      expected_version: 4,
      idempotency_key: "d1000000-0000-4000-8000-000000000001",
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/stays/${stayId}/payment-batches`,
          headers: headers([PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS]),
          payload,
        })
      ).statusCode,
    ).toBe(400);
    vi.mocked(repo.createPaymentBatch).mockResolvedValue({
      result: "version_conflict",
    });
    payload.tenders[1]!.payment_method = "cash";
    const conflict = await app.inject({
      method: "POST",
      url: `/admin/stays/${stayId}/payment-batches`,
      headers: headers([PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS]),
      payload,
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().details).toBe("version_conflict");
  });

  it("uses separate permissions for partial adjustment and full void", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const partial = {
      kind: "partial_adjustment",
      reason: "Item não consumido",
      expected_version: 4,
      items: [
        {
          order_item_id: "c3000000-0000-4000-8000-000000000001",
          resulting_quantity: 0,
          additional_discount: 0,
        },
      ],
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/consumption-orders/${orderId}/corrections`,
          headers: headers([PERMISSIONS.CONSUMPTION_VOID]),
          payload: partial,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/consumption-orders/${orderId}/corrections`,
          headers: headers([PERMISSIONS.CONSUMPTION_POST]),
          payload: partial,
        })
      ).statusCode,
    ).toBe(201);
    expect(repo.requestCorrection).toHaveBeenCalledWith(
      hotelId,
      orderId,
      expect.any(String),
      partial,
    );
  });

  it("protects the decision queue and hotel refunds with their permissions", async () => {
    const repo = repository();
    const app = await appWith(repo);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/consumption-corrections",
          headers: headers([PERMISSIONS.CONSUMPTION_READ]),
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/consumption-corrections?status=pending",
          headers: headers([PERMISSIONS.CONSUMPTION_ADJUSTMENT_APPROVE]),
        })
      ).statusCode,
    ).toBe(200);
    const refund = {
      amount: 8,
      payment_method: "pix",
      reason: "Ajuste aprovado",
      expected_version: 5,
      idempotency_key: "d1000000-0000-4000-8000-000000000002",
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/consumption-corrections/${correctionId}/refund`,
          headers: headers([PERMISSIONS.CONSUMPTION_ADJUSTMENT_APPROVE]),
          payload: refund,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/consumption-corrections/${correctionId}/refund`,
          headers: headers([PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE]),
          payload: refund,
        })
      ).statusCode,
    ).toBe(200);
  });
});
