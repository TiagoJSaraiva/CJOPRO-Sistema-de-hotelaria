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
import type { MaintenancePlanningRepository } from "../../src/repositories/maintenancePlanningRepository";
import { registerMaintenancePlanningRoutes } from "../../src/routes/maintenancePlanningRoutes";

const hotelId = "10000000-0000-4000-8000-000000000001";
const userId = "80000000-0000-4000-8000-000000000002";
const id = "97000000-0000-4000-8000-000000000001";
const apps: ReturnType<typeof Fastify>[] = [];

function headers(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const session: SessionPayload = {
    id: userId,
    name: "Operador",
    email: "operador@hotelaria.local",
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
  const repository: MaintenancePlanningRepository = {
    board: vi.fn().mockResolvedValue({
      generated_at: "2026-09-09T12:00:00Z",
      teams: [],
      schedules: [],
      backlog: [],
      users: [],
      summary: {
        scheduled: 0,
        backlog: 0,
        conflicts: 0,
        capacity_minutes: 0,
        allocated_minutes: 0,
      },
    }),
    saveTeam: vi.fn().mockResolvedValue({ result: "ok" }),
    addAvailabilityException: vi.fn().mockResolvedValue({ result: "ok" }),
    simulate: vi.fn().mockResolvedValue({
      result: "ok",
      item: {
        valid: true,
        planned_end: "2026-09-09T14:00:00Z",
        conflicts: [],
      },
    }),
    schedule: vi.fn().mockResolvedValue({ result: "ok" }),
    requestReschedule: vi.fn().mockResolvedValue({ result: "ok" }),
    decideReschedule: vi.fn().mockResolvedValue({ result: "ok" }),
    followUp: vi.fn().mockResolvedValue({ result: "ok" }),
    updateAffectedRooms: vi.fn().mockResolvedValue({ result: "ok" }),
    recurrence: vi
      .fn()
      .mockResolvedValue({ active: false, group: null, occurrences: [] }),
    saveRecurrencePolicy: vi.fn().mockResolvedValue({ result: "ok" }),
    actRecurrence: vi.fn().mockResolvedValue({ result: "ok" }),
    createLifecycle: vi.fn().mockResolvedValue({ result: "ok" }),
    actLifecycle: vi.fn().mockResolvedValue({ result: "ok" }),
    confirmService: vi.fn().mockResolvedValue({ result: "ok" }),
    recordCommunication: vi.fn().mockResolvedValue({ result: "ok" }),
    reconcile: vi.fn().mockResolvedValue({ result: "ok" }),
  };
  const app = Fastify();
  for (const schema of API_COMPONENT_SCHEMAS) app.addSchema(schema);
  app.addHook("onRoute", (options) => {
    const contract = API_ROUTE_CONTRACTS[`${options.method} ${options.url}`];
    if (contract) options.schema = contract;
  });
  registerMaintenancePlanningRoutes(app, repository);
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
    (await app.inject({ url: "/admin/maintenance/planning/board" })).statusCode,
  ).toBe(401);
  expect(
    (
      await app.inject({
        url: "/admin/maintenance/planning/board",
        headers: headers([]),
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        url: "/admin/maintenance/planning/board",
        headers: headers([PERMISSIONS.MAINTENANCE_EXECUTE]),
      })
    ).statusCode,
  ).toBe(200);
  expect(repository.board).toHaveBeenCalledWith(hotelId, undefined, undefined);
}, 20_000);

it("exige permissão separada para exceção de conflito", async () => {
  const { app, repository } = await setup();
  const payload = {
    technician_id: userId,
    planned_start: "2026-09-09T13:00:00Z",
    estimated_minutes: 60,
    access_kind: "free",
    override_conflicts: true,
    override_reason: "Atendimento crítico autorizado",
  };
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/maintenance/work-orders/${id}/schedule`,
        headers: headers([PERMISSIONS.MAINTENANCE_SCHEDULE_MANAGE]),
        payload,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/maintenance/work-orders/${id}/schedule`,
        headers: headers([
          PERMISSIONS.MAINTENANCE_SCHEDULE_MANAGE,
          PERMISSIONS.MAINTENANCE_SCHEDULE_OVERRIDE,
        ]),
        payload,
      })
    ).statusCode,
  ).toBe(200);
  expect(repository.schedule).toHaveBeenCalledTimes(1);
}, 20_000);

it("separa proposta, aprovação e confirmação de atendimento", async () => {
  const { app } = await setup();
  const action = {
    action: "approve",
    expected_version: 1,
    selected_option_id: id,
    reason: "Alternativa aprovada pela gestão",
  };
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/maintenance/lifecycle-decisions/${id}/actions`,
        headers: headers([PERMISSIONS.MAINTENANCE_LIFECYCLE_PROPOSE]),
        payload: action,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/maintenance/lifecycle-decisions/${id}/actions`,
        headers: headers([PERMISSIONS.MAINTENANCE_LIFECYCLE_APPROVE]),
        payload: action,
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        method: "POST",
        url: `/admin/maintenance/work-orders/${id}/service-confirmations`,
        headers: headers([PERMISSIONS.MAINTENANCE_EXECUTE]),
        payload: { result: "arrived", notes: "Prestador presente na recepção" },
      })
    ).statusCode,
  ).toBe(403);
}, 20_000);

it("traduz conflito concorrente como HTTP 409", async () => {
  const { app, repository } = await setup();
  vi.mocked(repository.followUp).mockResolvedValueOnce({
    result: "conflict",
    context: { owner_id: userId },
  });
  const response = await app.inject({
    method: "POST",
    url: `/admin/maintenance/work-orders/${id}/waiting-follow-ups`,
    headers: headers([PERMISSIONS.MAINTENANCE_EXECUTE]),
    payload: {
      notes: "Fornecedor ainda não respondeu",
      next_follow_up_at: "2026-09-10T13:00:00Z",
      expected_version: 1,
    },
  });
  expect(response.statusCode).toBe(409);
  expect(response.json().context).toEqual({ owner_id: userId });
}, 20_000);
