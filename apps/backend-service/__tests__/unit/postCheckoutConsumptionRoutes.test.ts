import Fastify from "fastify";
import { afterEach, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type SessionPayload,
} from "@hotel/shared";
import {
  API_COMPONENT_SCHEMAS,
  API_ROUTE_CONTRACTS,
} from "@hotel/shared/api-contract";
import { signToken } from "../../src/auth/session";
import type { PostCheckoutConsumptionRepository } from "../../src/repositories/postCheckoutConsumptionRepository";
import { registerPostCheckoutConsumptionRoutes } from "../../src/routes/postCheckoutConsumptionRoutes";

const hotelId = "10000000-0000-4000-8000-000000000001";
const userId = "80000000-0000-4000-8000-000000000002";
const caseId = "a4400000-0000-4000-8000-000000000001";
const apps: ReturnType<typeof Fastify>[] = [];

function headers(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const session: SessionPayload = {
    id: userId,
    name: "Operador",
    email: "operador@hotelaria.local",
    tenantId: null,
    roles: ["Consumo"],
    permissions,
    roleAssignments: [
      {
        roleId: "role",
        roleName: "Consumo",
        roleType: "HOTEL_ROLE",
        hotelId,
        hotelName: "Hotel",
      },
    ],
    iat: now,
    exp: now + 3600,
  };
  return {
    authorization: `Bearer ${signToken(session)}`,
    [ACTIVE_HOTEL_HEADER_NAME]: hotelId,
  };
}

async function setup() {
  const repository: PostCheckoutConsumptionRepository = {
    departureReview: vi.fn().mockResolvedValue({
      stay_id: caseId,
      ready: true,
      blockers: [],
      payer_balances: [],
      account_version: 1,
      updated_at: "2026-09-11T10:00:00.000Z",
    }),
    list: vi
      .fn()
      .mockResolvedValue({ items: [], updated_at: "2026-09-11T10:00:00.000Z" }),
    create: vi.fn().mockResolvedValue({ result: "ok", case_id: caseId }),
    act: vi.fn().mockResolvedValue({ result: "ok" }),
    addEvidence: vi.fn().mockResolvedValue({ result: "ok" }),
    pay: vi.fn().mockResolvedValue({ result: "ok" }),
    payCorporate: vi.fn().mockResolvedValue({ result: "ok" }),
  };
  const app = Fastify();
  for (const schema of API_COMPONENT_SCHEMAS) app.addSchema(schema);
  app.addHook("onRoute", (options) => {
    const contract = API_ROUTE_CONTRACTS[`${options.method} ${options.url}`];
    if (contract) options.schema = contract;
  });
  registerPostCheckoutConsumptionRoutes(app, repository);
  await app.ready();
  apps.push(app);
  return { app, repository };
}

afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

it("protege revisão, dispensa e recebimento com permissões independentes", async () => {
  const { app, repository } = await setup();
  expect(
    (await app.inject({ url: "/admin/post-checkout-consumption" })).statusCode,
  ).toBe(401);
  expect(
    (
      await app.inject({
        url: "/admin/post-checkout-consumption",
        headers: headers([]),
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        url: "/admin/post-checkout-consumption",
        headers: headers([PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE]),
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        url: "/admin/post-checkout-consumption",
        headers: headers([PERMISSIONS.POST_CHECKOUT_CONSUMPTION_WAIVE]),
      })
    ).statusCode,
  ).toBe(200);
  const action = {
    action: "waive",
    expected_version: 2,
    reason: "Contestação procedente",
  };
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/post-checkout-consumption/${caseId}/actions`,
        headers: headers([PERMISSIONS.POST_CHECKOUT_CONSUMPTION_REVIEW]),
        payload: action,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/post-checkout-consumption/${caseId}/actions`,
        headers: headers([PERMISSIONS.POST_CHECKOUT_CONSUMPTION_WAIVE]),
        payload: action,
      })
    ).statusCode,
  ).toBe(200);
  expect(repository.act).toHaveBeenCalledWith(hotelId, caseId, userId, action);
}, 20_000);

it("retorna 409 com contexto quando o caso muda", async () => {
  const { app, repository } = await setup();
  vi.mocked(repository.pay).mockResolvedValue({
    result: "version_conflict",
    context: { version: 3 },
  });
  const response = await app.inject({
    method: "POST",
    url: `/admin/post-checkout-consumption/${caseId}/payments`,
    headers: headers([PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE]),
    payload: {
      expected_version: 2,
      idempotency_key: "a4400000-0000-4000-8000-000000000099",
      tenders: [{ payment_method: "pix", amount: 10 }],
    },
  });
  expect(response.statusCode).toBe(409);
  expect(response.json().context).toEqual({ version: 3 });
});
