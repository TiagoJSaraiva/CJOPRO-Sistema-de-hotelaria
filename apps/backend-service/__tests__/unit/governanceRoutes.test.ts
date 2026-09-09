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
import { registerGovernanceRoutes } from "../../src/routes/governanceRoutes";
import type { GovernanceRepository } from "../../src/repositories/governanceRepository";

const hotelId = "10000000-0000-4000-8000-000000000001";
const userId = "80000000-0000-4000-8000-000000000002";
const cycleId = "a0000000-0000-4000-8000-000000000001";
const taskId = "a0000000-0000-4000-8000-000000000002";
const roomId = "20000000-0000-4000-8000-000000000101";
const apps: ReturnType<typeof Fastify>[] = [];

function headers(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const session: SessionPayload = {
    id: userId,
    name: "Operador",
    email: "operador@hotelaria.local",
    tenantId: null,
    roles: ["Governança"],
    permissions,
    roleAssignments: [
      {
        roleId: "role",
        roleName: "Governança",
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

const cycle = {
  id: cycleId,
  hotel_id: hotelId,
  room_id: roomId,
  room_number: "101",
  stay_id: null,
  status: "cleaning_pending" as const,
  source: "manual" as const,
  version: 1,
  next_arrival_at: null,
  severity: "info" as const,
  last_updated_at: "2026-09-08T12:00:00Z",
  released_at: null,
  events: [],
  tasks: [
    {
      id: taskId,
      kind: "cleaning" as const,
      status: "pending" as const,
      assigned_to: null,
      assignee_name: null,
      next_action: null,
      version: 1,
      started_at: null,
      completed_at: null,
      checklist: [],
    },
  ],
};
const board = {
  items: [cycle],
  rooms: [{ id: roomId, room_number: "101", room_type: "Standard" }],
  maintenance_categories: [],
  minibar_options: [],
  assignable_users: [],
  summary: { total: 1, critical: 0, unassigned: 1, awaiting_inspection: 0 },
};

async function setup() {
  const repository: GovernanceRepository = {
    listBoard: vi.fn().mockResolvedValue(board),
    getCycle: vi.fn().mockResolvedValue(cycle),
    createCycle: vi.fn().mockResolvedValue({ result: "ok", item: cycle }),
    act: vi.fn().mockResolvedValue({ result: "ok", item: cycle }),
    registerMinibar: vi.fn().mockResolvedValue({ result: "ok", item: cycle }),
    createDefect: vi.fn().mockResolvedValue({ result: "ok", item: cycle }),
    listTemplates: vi.fn().mockResolvedValue([]),
    createTemplate: vi.fn(),
    roomState: vi.fn(),
    simulateRelocation: vi
      .fn()
      .mockResolvedValue({ result: "ok", version: 2, items: [] }),
    relocate: vi.fn().mockResolvedValue({ result: "ok" }),
  };
  const app = Fastify();
  for (const schema of API_COMPONENT_SCHEMAS) app.addSchema(schema);
  app.addHook("onRoute", (options) => {
    const contract = API_ROUTE_CONTRACTS[`${options.method} ${options.url}`];
    if (contract) options.schema = contract;
  });
  registerGovernanceRoutes(app, repository);
  await app.ready();
  apps.push(app);
  return { app, repository };
}

afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

it("protege o quadro por identidade, permissão e hotel ativo", async () => {
  const { app, repository } = await setup();
  expect(
    (await app.inject({ url: "/admin/governance/board" })).statusCode,
  ).toBe(401);
  expect(
    (await app.inject({ url: "/admin/governance/board", headers: headers([]) }))
      .statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        url: "/admin/governance/board",
        headers: headers([PERMISSIONS.GOVERNANCE_READ]),
      })
    ).statusCode,
  ).toBe(200);
  expect(repository.listBoard).toHaveBeenCalledWith(hotelId);
});

it("separa execução, inspeção e atribuição", async () => {
  const { app, repository } = await setup();
  const post = (action: string, permissions: string[]) =>
    app.inject({
      method: "POST",
      url: `/admin/governance/cycles/${cycleId}/actions`,
      headers: headers(permissions),
      payload: {
        action,
        task_id: taskId,
        expected_version: 1,
        note: "Motivo operacional",
      },
    });
  expect(
    (await post("claim", [PERMISSIONS.GOVERNANCE_EXECUTE])).statusCode,
  ).toBe(200);
  expect(
    (await post("approve", [PERMISSIONS.GOVERNANCE_EXECUTE])).statusCode,
  ).toBe(403);
  expect(
    (await post("approve", [PERMISSIONS.GOVERNANCE_INSPECT])).statusCode,
  ).toBe(200);
  expect(
    (await post("assign", [PERMISSIONS.GOVERNANCE_EXECUTE])).statusCode,
  ).toBe(403);
  expect(repository.act).toHaveBeenCalledTimes(2);
});

it("registra divergência sem permissão financeira e bloqueia lançamento", async () => {
  const { app, repository } = await setup();
  const common = {
    idempotency_key: "b0000000-0000-4000-8000-000000000001",
    items: [{ offer_id: "b0000000-0000-4000-8000-000000000002", quantity: 1 }],
  };
  const discrepancy = await app.inject({
    method: "POST",
    url: `/admin/governance/cycles/${cycleId}/minibar`,
    headers: headers([PERMISSIONS.GOVERNANCE_EXECUTE]),
    payload: {
      ...common,
      discrepancy_only: true,
      notes: "Encontrado após a saída",
    },
  });
  expect(discrepancy.statusCode).toBe(200);
  const charge = await app.inject({
    method: "POST",
    url: `/admin/governance/cycles/${cycleId}/minibar`,
    headers: headers([PERMISSIONS.GOVERNANCE_EXECUTE]),
    payload: {
      ...common,
      point_id: "b0000000-0000-4000-8000-000000000003",
      occurred_at: "2026-09-08T12:00:00Z",
      disposition: "charged",
      billing_mode: "stay_folio",
    },
  });
  expect(charge.statusCode).toBe(403);
  expect(repository.registerMinibar).toHaveBeenCalledTimes(1);
});

it("revalida a versão da realocação e traduz conflito", async () => {
  const { app, repository } = await setup();
  vi.mocked(repository.relocate).mockResolvedValueOnce({ result: "conflict" });
  const response = await app.inject({
    method: "POST",
    url: "/admin/stays/91000000-0000-4000-8000-000000000001/relocation",
    headers: headers([PERMISSIONS.RESERVATION_RELOCATE]),
    payload: {
      destination_room_id: "20000000-0000-4000-8000-000000000102",
      expected_version: 1,
      reason: "Interdição do quarto original",
    },
  });
  expect(response.statusCode).toBe(409);
});
