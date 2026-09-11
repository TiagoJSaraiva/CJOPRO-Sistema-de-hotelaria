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
import type { OperationsFinanceRepository } from "../../src/repositories/operationsFinanceRepository";
import { registerOperationsFinanceRoutes } from "../../src/routes/operationsFinanceRoutes";

const hotel = "10000000-0000-4000-8000-000000000001",
  user = "80000000-0000-4000-8000-000000000002",
  id = "90000000-0000-4000-8000-000000000001";
const apps: ReturnType<typeof Fastify>[] = [];
function headers(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const session: SessionPayload = {
    id: user,
    name: "Operador",
    email: "operador@hotel.local",
    tenantId: null,
    roles: ["Operação"],
    permissions,
    roleAssignments: [
      {
        roleId: "role",
        roleName: "Operação",
        roleType: "HOTEL_ROLE",
        hotelId: hotel,
        hotelName: "Hotel",
      },
    ],
    iat: now,
    exp: now + 3600,
  };
  return {
    authorization: `Bearer ${signToken(session)}`,
    [ACTIVE_HOTEL_HEADER_NAME]: hotel,
  };
}
async function setup() {
  const repository: OperationsFinanceRepository = {
    rpc: vi.fn().mockResolvedValue({ registers: [], projection: {} }),
    mutation: vi.fn().mockResolvedValue({ result: "ok", id }),
  };
  const app = Fastify();
  for (const schema of API_COMPONENT_SCHEMAS) app.addSchema(schema);
  app.addHook("onRoute", (options) => {
    const contract = API_ROUTE_CONTRACTS[`${options.method} ${options.url}`];
    if (contract) options.schema = contract;
  });
  registerOperationsFinanceRoutes(app, repository);
  await app.ready();
  apps.push(app);
  return { app, repository };
}
afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

it("protege autenticação, permissão e hotel ativo", async () => {
  const { app, repository } = await setup();
  expect(
    (await app.inject({ url: "/admin/procurement/board" })).statusCode,
  ).toBe(401);
  expect(
    (
      await app.inject({
        url: "/admin/procurement/board",
        headers: headers([]),
      })
    ).statusCode,
  ).toBe(403);
  expect(repository.rpc).not.toHaveBeenCalled();
});

it("lista o quadro sem realizar reconciliação em uma leitura", async () => {
  const { app, repository } = await setup();
  expect(
    (
      await app.inject({
        url: "/admin/procurement/board",
        headers: headers([PERMISSIONS.PROCUREMENT_READ]),
      })
    ).statusCode,
  ).toBe(200);
  expect(repository.rpc).toHaveBeenCalledWith("list_procurement_board", {
    p_hotel_id: hotel,
  });
  expect(repository.mutation).not.toHaveBeenCalled();
});

it("valida contrato e encaminha a criação de reposição", async () => {
  const { app, repository } = await setup();
  const post = (payload: unknown) =>
    app.inject({
      method: "POST",
      url: "/admin/procurement/replenishment-requests",
      headers: headers([PERMISSIONS.PROCUREMENT_REQUEST]),
      payload,
    });
  expect((await post({})).statusCode).toBe(400);
  expect(
    (
      await post({
        product_id: id,
        location_id: "91000000-0000-4000-8000-000000000001",
        requested_quantity: 2,
        priority: "high",
        reason: "Saldo crítico",
      })
    ).statusCode,
  ).toBe(201);
  expect(repository.mutation).toHaveBeenCalledWith(
    "create_replenishment_request",
    expect.objectContaining({ p_hotel_id: hotel, p_actor_id: user }),
  );
});

it("traduz conflito concorrente e separa aprovação de caixa", async () => {
  const { app, repository } = await setup();
  vi.mocked(repository.mutation).mockResolvedValueOnce({ result: "conflict" });
  const response = await app.inject({
    method: "POST",
    url: `/admin/cash-sessions/${id}/actions`,
    headers: headers([PERMISSIONS.CASH_DIFFERENCES_APPROVE]),
    payload: {
      action: "approve_difference",
      expected_version: 2,
      reason: "Diferença conferida",
      idempotency_key: "92000000-0000-4000-8000-000000000001",
    },
  });
  expect(response.statusCode).toBe(409);
  expect(repository.mutation).toHaveBeenCalledWith(
    "act_cash_session",
    expect.objectContaining({ p_actor_id: user }),
  );
});

it("exige payload completo para baixa parcial", async () => {
  const { app, repository } = await setup();
  const response = await app.inject({
    method: "POST",
    url: `/admin/consumption/partner-settlements/${id}/payments`,
    headers: headers([PERMISSIONS.PARTNER_SETTLEMENTS_SETTLE]),
    payload: {
      expected_version: 1,
      idempotency_key: "92000000-0000-4000-8000-000000000001",
      tenders: [],
    },
  });
  expect(response.statusCode).toBe(400);
  expect(repository.mutation).not.toHaveBeenCalled();
});
