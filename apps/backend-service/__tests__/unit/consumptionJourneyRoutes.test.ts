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
import type { ConsumptionJourneyRepository } from "../../src/repositories/consumptionJourneyRepository";
import { registerConsumptionJourneyRoutes } from "../../src/routes/consumptionJourneyRoutes";

const hotelId = "10000000-0000-4000-8000-000000000001";
const userId = "80000000-0000-4000-8000-000000000002";
const orderId = "a4000000-0000-4000-8000-000000000001";
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
  const item = {
    id: orderId,
    hotel_id: hotelId,
    stay_id: "90000000-0000-4000-8000-000000000001",
    point_id: "93000000-0000-4000-8000-000000000001",
    guest_customer_id: null,
    mode: "restaurant",
    status: "received",
    responsible_id: null,
    expected_at: null,
    notes: null,
    version: 0,
    gross_amount: 10,
    reserved_benefit_amount: 0,
    created_at: "2026-09-11T10:00:00Z",
    updated_at: "2026-09-11T10:00:00Z",
    items: [],
    events: [],
    produced_order_ids: [],
  };
  const repository: ConsumptionJourneyRepository = {
    board: vi.fn().mockResolvedValue({
      items: [item],
      summary: {},
      updated_at: item.updated_at,
    }),
    serviceOrder: vi.fn().mockResolvedValue(item),
    createServiceOrder: vi
      .fn()
      .mockResolvedValue({ result: "ok", order_id: orderId }),
    actOnServiceOrder: vi.fn().mockResolvedValue({ result: "ok" }),
  };
  const app = Fastify();
  for (const schema of API_COMPONENT_SCHEMAS) app.addSchema(schema);
  app.addHook("onRoute", (options) => {
    const contract = API_ROUTE_CONTRACTS[`${options.method} ${options.url}`];
    if (contract) options.schema = contract;
  });
  registerConsumptionJourneyRoutes(app, repository);
  await app.ready();
  apps.push(app);
  return { app, repository };
}

afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

it("protege a fila por leitura e hotel ativo", async () => {
  const { app, repository } = await setup();
  expect(
    (await app.inject({ url: "/admin/consumption-service/board" })).statusCode,
  ).toBe(401);
  expect(
    (
      await app.inject({
        url: "/admin/consumption-service/board",
        headers: headers([]),
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        url: "/admin/consumption-service/board",
        headers: headers([PERMISSIONS.CONSUMPTION_READ]),
      })
    ).statusCode,
  ).toBe(200);
  expect(repository.board).toHaveBeenCalledWith(hotelId, {});
}, 20_000);

it("separa cancelamento e exige lançamento financeiro na entrega", async () => {
  const { app, repository } = await setup();
  const cancel = {
    action: "cancel",
    expected_version: 0,
    reason: "Solicitação do hóspede",
  };
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/consumption-service/orders/${orderId}/actions`,
        headers: headers([PERMISSIONS.CONSUMPTION_SERVICE_MANAGE]),
        payload: cancel,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/consumption-service/orders/${orderId}/actions`,
        headers: headers([PERMISSIONS.CONSUMPTION_SERVICE_CANCEL]),
        payload: cancel,
      })
    ).statusCode,
  ).toBe(200);
  const deliver = {
    action: "deliver",
    expected_version: 0,
    idempotency_key: "a4000000-0000-4000-8000-000000000099",
  };
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/consumption-service/orders/${orderId}/actions`,
        headers: headers([PERMISSIONS.CONSUMPTION_SERVICE_MANAGE]),
        payload: deliver,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/consumption-service/orders/${orderId}/actions`,
        headers: headers([
          PERMISSIONS.CONSUMPTION_SERVICE_MANAGE,
          PERMISSIONS.CONSUMPTION_POST,
        ]),
        payload: deliver,
      })
    ).statusCode,
  ).toBe(200);
  expect(repository.actOnServiceOrder).toHaveBeenCalledTimes(2);
}, 20_000);
