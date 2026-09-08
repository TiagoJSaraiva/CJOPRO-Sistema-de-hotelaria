import Fastify from "fastify";
import { afterEach, expect, it, vi } from "vitest";
import { ACTIVE_HOTEL_HEADER_NAME, type SessionPayload } from "@hotel/shared";
import {
  API_ROUTE_CONTRACTS,
  API_COMPONENT_SCHEMAS,
} from "@hotel/shared/api-contract";
import { signToken } from "../../src/auth/session";
import { registerOperationalPendingRoutes } from "../../src/routes/operationalPendingRoutes";
const hotel = "10000000-0000-4000-8000-000000000001",
  user = "80000000-0000-4000-8000-000000000002",
  id = "a0000000-0000-4000-8000-000000000001";
const apps: ReturnType<typeof Fastify>[] = [];
function headers(permissions = ["read_inventory"], hotelId = hotel) {
  const now = Math.floor(Date.now() / 1000);
  const session: SessionPayload = {
    id: user,
    name: "Gestor",
    email: "gestor@hotelaria.local",
    tenantId: null,
    roles: ["Gestor"],
    permissions,
    roleAssignments: [
      {
        roleId: "role",
        roleName: "Gestor",
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
    [ACTIVE_HOTEL_HEADER_NAME]: hotelId,
  };
}
const empty = {
  items: [],
  total: 0,
  summary: { open: 0, claimed: 0, resolved: 0, unread: 0 },
  sync: { last_success_at: null, error_message: null },
};
async function setup() {
  const repo = {
    list: vi.fn().mockResolvedValue(empty),
    act: vi.fn().mockResolvedValue("ok"),
    reconcile: vi.fn().mockResolvedValue("ok"),
  };
  const app = Fastify();
  for (const schema of API_COMPONENT_SCHEMAS) app.addSchema(schema);
  app.addHook("onRoute", (options) => {
    const contract = API_ROUTE_CONTRACTS[`${options.method} ${options.url}`];
    if (contract) options.schema = contract;
  });
  registerOperationalPendingRoutes(app, repo);
  await app.ready();
  apps.push(app);
  return { app, repo };
}
afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});
it("protege identidade, permissão e hotel sem consultar dados", async () => {
  const { app, repo } = await setup();
  expect(
    (await app.inject({ url: "/admin/operational-pending" })).statusCode,
  ).toBe(401);
  expect(
    (
      await app.inject({
        url: "/admin/operational-pending",
        headers: headers([]),
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        url: "/admin/operational-pending",
        headers: headers(undefined, "10000000-0000-4000-8000-000000000002"),
      })
    ).statusCode,
  ).toBe(403);
  expect(repo.list).not.toHaveBeenCalled();
});
it("GET é somente leitura e filtros inválidos são recusados", async () => {
  const { app, repo } = await setup();
  expect(
    (
      await app.inject({
        url: "/admin/operational-pending?page=2",
        headers: headers(),
      })
    ).statusCode,
  ).toBe(200);
  expect(repo.list).toHaveBeenCalledWith(hotel, user, ["read_inventory"], {
    page: "2",
  });
  expect(repo.reconcile).not.toHaveBeenCalled();
  expect(
    (
      await app.inject({
        url: "/admin/operational-pending?page=-1",
        headers: headers(),
      })
    ).statusCode,
  ).toBe(400);
});
it("valida ações e traduz conflitos sem expor dados de outra origem", async () => {
  const { app, repo } = await setup();
  const post = (payload: unknown) =>
    app.inject({
      method: "POST",
      url: "/admin/operational-pending/actions",
      headers: headers(),
      payload,
    });
  expect((await post({ ids: [id], action: "claim" })).statusCode).toBe(400);
  expect((await post({ ids: [id], action: "resolve" })).statusCode).toBe(400);
  expect(repo.act).not.toHaveBeenCalled();
  expect((await post({ ids: [id], action: "read" })).statusCode).toBe(200);
  for (const [result, status] of [
    ["conflict", 409],
    ["not_found", 404],
    ["invalid", 400],
  ] as const) {
    repo.act.mockResolvedValueOnce(result);
    expect(
      (await post({ ids: [id], action: "claim", expected_version: 1 }))
        .statusCode,
    ).toBe(status);
  }
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/admin/operational-pending/reconcile",
        headers: headers(),
      })
    ).statusCode,
  ).toBe(200);
  repo.reconcile.mockResolvedValueOnce("failed");
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/admin/operational-pending/reconcile",
        headers: headers(),
      })
    ).statusCode,
  ).toBe(503);
});
