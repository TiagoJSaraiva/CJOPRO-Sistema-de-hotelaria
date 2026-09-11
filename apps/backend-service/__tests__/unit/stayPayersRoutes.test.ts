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
import type { StayPayersRepository } from "../../src/repositories/stayPayersRepository";
import { registerStayPayersRoutes } from "../../src/routes/stayPayersRoutes";

const hotelId = "10000000-0000-4000-8000-000000000001";
const userId = "80000000-0000-4000-8000-000000000002";
const stayId = "90000000-0000-4000-8000-000000000001";
const entityId = "a4200000-0000-4000-8000-000000000001";
const apps: ReturnType<typeof Fastify>[] = [];

function headers(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const session: SessionPayload = {
    id: userId,
    name: "Operador",
    email: "operator@local.test",
    tenantId: null,
    roles: ["Operação"],
    permissions,
    roleAssignments: [
      {
        roleId: "role",
        roleName: "Operação",
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
  const repository: StayPayersRepository = {
    list: vi
      .fn()
      .mockResolvedValue({ stay_id: stayId, account_version: 1, items: [] }),
    create: vi.fn().mockResolvedValue({ result: "ok" }),
    allocate: vi.fn().mockResolvedValue({ result: "ok" }),
    pay: vi.fn().mockResolvedValue({ result: "ok" }),
    listCompanies: vi.fn().mockResolvedValue({ items: [] }),
    saveCompany: vi.fn().mockResolvedValue({ result: "ok" }),
    requestCredit: vi.fn().mockResolvedValue({ result: "ok" }),
    actCredit: vi.fn().mockResolvedValue({ result: "ok" }),
  };
  const app = Fastify();
  for (const schema of API_COMPONENT_SCHEMAS) app.addSchema(schema);
  app.addHook("onRoute", (options) => {
    const contract = API_ROUTE_CONTRACTS[`${options.method} ${options.url}`];
    if (contract) options.schema = contract;
  });
  registerStayPayersRoutes(app, repository);
  await app.ready();
  apps.push(app);
  return { app, repository };
}

afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

it("separa leitura, gestão de pagadores e recebimento", async () => {
  const { app, repository } = await setup();
  expect(
    (
      await app.inject({
        url: `/admin/stays/${stayId}/payer-accounts`,
        headers: headers([]),
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        url: `/admin/stays/${stayId}/payer-accounts`,
        headers: headers([PERMISSIONS.CONSUMPTION_READ]),
      })
    ).statusCode,
  ).toBe(200);
  const response = await app.inject({
    method: "POST",
    url: `/admin/stays/${stayId}/payer-payments`,
    headers: headers([PERMISSIONS.STAY_PAYERS_MANAGE]),
    payload: {
      payer_account_id: entityId,
      expected_account_version: 1,
      idempotency_key: "a4200000-0000-4000-8000-000000000002",
      tenders: [{ payment_method: "pix", amount: 10 }],
    },
  });
  expect(response.statusCode).toBe(403);
  expect(repository.pay).not.toHaveBeenCalled();
});

it("exige permissão de aprovação para decidir crédito", async () => {
  const { app, repository } = await setup();
  const payload = {
    action: "approve",
    expected_version: 0,
    reason: "Crédito conferido pela gestão",
  };
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/corporate-credit-authorizations/${entityId}/actions`,
        headers: headers([PERMISSIONS.CORPORATE_CREDIT_REQUEST]),
        payload,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/corporate-credit-authorizations/${entityId}/actions`,
        headers: headers([PERMISSIONS.CORPORATE_CREDIT_APPROVE]),
        payload,
      })
    ).statusCode,
  ).toBe(200);
  expect(repository.actCredit).toHaveBeenCalledOnce();
});
