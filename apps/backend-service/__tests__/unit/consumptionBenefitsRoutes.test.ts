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
import type { ConsumptionBenefitsRepository } from "../../src/repositories/consumptionBenefitsRepository";
import { registerConsumptionBenefitsRoutes } from "../../src/routes/consumptionBenefitsRoutes";
const hotelId = "10000000-0000-4000-8000-000000000001",
  userId = "80000000-0000-4000-8000-000000000002",
  id = "a4300000-0000-4000-8000-000000000001";
const apps: ReturnType<typeof Fastify>[] = [];
function headers(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const session: SessionPayload = {
    id: userId,
    name: "Gestor",
    email: "gestor@local.test",
    tenantId: null,
    roles: ["Gestão"],
    permissions,
    roleAssignments: [
      {
        roleId: "role",
        roleName: "Gestão",
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
  const repository: ConsumptionBenefitsRepository = {
    list: vi.fn().mockResolvedValue({ items: [] }),
    createPlan: vi.fn().mockResolvedValue({ result: "ok" }),
    createVersion: vi.fn().mockResolvedValue({ result: "ok" }),
    grant: vi.fn().mockResolvedValue({ result: "ok" }),
    transfer: vi.fn().mockResolvedValue({ result: "ok" }),
  };
  const app = Fastify();
  for (const schema of API_COMPONENT_SCHEMAS) app.addSchema(schema);
  app.addHook("onRoute", (options) => {
    const contract = API_ROUTE_CONTRACTS[`${options.method} ${options.url}`];
    if (contract) options.schema = contract;
  });
  registerConsumptionBenefitsRoutes(app, repository);
  await app.ready();
  apps.push(app);
  return { app, repository };
}
afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});
it("protege configuração e transferência com permissões independentes", async () => {
  const { app, repository } = await setup();
  const plan = { name: "Café incluído" };
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/admin/consumption-benefit-plans",
        headers: headers([PERMISSIONS.CONSUMPTION_READ]),
        payload: plan,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/admin/consumption-benefit-plans",
        headers: headers([PERMISSIONS.CONSUMPTION_BENEFITS_MANAGE]),
        payload: plan,
      })
    ).statusCode,
  ).toBe(201);
  const transfer = {
    destination_stay_id: id,
    guest_customer_id: id,
    payer_account_id: id,
    expected_source_version: 1,
    expected_destination_version: 1,
    reason: "Comanda lançada no quarto incorreto",
    items: [{ order_item_id: id, quantity: 1 }],
  };
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/consumption-orders/${id}/transfer/simulate`,
        headers: headers([PERMISSIONS.CONSUMPTION_BENEFITS_MANAGE]),
        payload: transfer,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/consumption-orders/${id}/transfer/simulate`,
        headers: headers([PERMISSIONS.CONSUMPTION_TRANSFER]),
        payload: transfer,
      })
    ).statusCode,
  ).toBe(200);
  expect(repository.transfer).toHaveBeenCalledWith(
    hotelId,
    id,
    userId,
    transfer,
    true,
  );
});
