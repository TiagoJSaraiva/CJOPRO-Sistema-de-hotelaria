import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type AdminMaintenanceOccurrenceDetail,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../src/auth/session";
import type { MaintenanceRepository } from "../../src/repositories/maintenanceRepository";
import { registerMaintenanceRoutes } from "../../src/routes/maintenanceRoutes";

const HOTEL_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "80000000-0000-4000-8000-000000000002";
const OCCURRENCE_ID = "97000000-0000-4000-8000-000000000001";
const CATEGORY_ID = "91000000-0000-4000-8000-000000000001";
const ROOM_ID = "20000000-0000-4000-8000-000000000101";
const appsToClose: Array<ReturnType<typeof Fastify>> = [];

function token(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    id: USER_ID,
    name: "Gestor",
    email: "gestor@hotelaria.local",
    tenantId: null,
    roles: ["Gestor"],
    permissions,
    roleAssignments: [
      {
        roleId: "role-1",
        roleName: "Gestor",
        roleType: "HOTEL_ROLE",
        hotelId: HOTEL_ID,
        hotelName: "Hotel",
      },
    ],
    iat: now,
    exp: now + 3600,
  };
  return signToken(payload);
}

function occurrence(
  overrides: Partial<AdminMaintenanceOccurrenceDetail> = {},
): AdminMaintenanceOccurrenceDetail {
  return {
    id: OCCURRENCE_ID,
    occurrence_number: 1,
    code: "OCO-000001",
    kind: "damage",
    priority: "high",
    status: "reported",
    description: "Televisor com tela quebrada",
    category_id: CATEGORY_ID,
    category_name: "Eletrônicos",
    room_id: ROOM_ID,
    room_number: "101",
    location_id: null,
    location_name: null,
    stay_id: null,
    reported_by: USER_ID,
    reporter_name: "Gestor",
    blocking_recommended: true,
    liability_status: "not_assessed",
    active_block: false,
    open_work_orders: 0,
    created_at: "2026-08-31T10:00:00Z",
    updated_at: "2026-08-31T10:00:00Z",
    discovered_at: "2026-08-31T10:00:00Z",
    triaged_by: null,
    triaged_at: null,
    suspected_party: null,
    confirmed_party: null,
    liability_notes: null,
    duplicate_of_id: null,
    canceled_reason: null,
    resolved_at: null,
    work_orders: [],
    inspections: [],
    events: [],
    attachments: [],
    room_blocks: [],
    ...overrides,
  };
}

function repository(
  overrides: Partial<MaintenanceRepository> = {},
): MaintenanceRepository {
  const item = occurrence();
  return {
    listOccurrences: vi.fn(async () => ({
      items: [item],
      page: 1,
      page_size: 20,
      total: 1,
    })),
    getStayMaintenance: vi.fn(async () => ({
      occurrences: [],
      acknowledgementRequired: false,
    })),
    getOccurrence: vi.fn(async () => item),
    getWorkOrderAccess: vi.fn(async () => ({
      assignedTo: USER_ID,
      occurrenceId: OCCURRENCE_ID,
    })),
    createOccurrence: vi.fn(async () => item),
    updateOccurrence: vi.fn(async () => ({ result: "ok", item })),
    addComment: vi.fn(async () => ({ result: "ok", item })),
    createWorkOrder: vi.fn(async () => ({ result: "ok", item })),
    transitionWorkOrder: vi.fn(async () => ({ result: "ok", item })),
    inspectWorkOrder: vi.fn(async () => ({ result: "ok", item })),
    createRoomBlock: vi.fn(async () => ({ result: "ok", item })),
    releaseRoomBlock: vi.fn(async () => ({ result: "ok", item })),
    listCategories: vi.fn(async () => []),
    writeCategory: vi.fn(async () => ({ result: "conflict" })),
    listLocations: vi.fn(async () => []),
    writeLocation: vi.fn(async () => ({ result: "conflict" })),
    getReferenceData: vi.fn(async () => ({
      categories: [],
      locations: [],
      rooms: [],
      stays: [],
      assignable_users: [],
    })),
    getSummary: vi.fn(async () => ({
      open: 1,
      assigned_to_me: 0,
      unassigned: 0,
      overdue: 0,
      awaiting_inspection: 0,
      blocked_rooms: 0,
    })),
    countAttachments: vi.fn(async () => 0),
    createUploadIntent: vi.fn(async () => ({
      storage_path: "path",
      token: "token",
      signed_url: "url",
    })),
    finalizeAttachments: vi.fn(async () => ({ result: "ok", item })),
    createAttachmentAccess: vi.fn(async () => ({
      signed_url: "url",
      expires_in: 300,
    })),
    getAttachmentOccurrenceId: vi.fn(async () => OCCURRENCE_ID),
    removeAttachment: vi.fn(async () => ({ result: "ok", item })),
    ...overrides,
  };
}

async function appWith(repo: MaintenanceRepository) {
  const app = Fastify({ logger: false });
  registerMaintenanceRoutes(app, repo);
  await app.ready();
  appsToClose.push(app);
  return app;
}
function headers(permissions: string[]) {
  return {
    authorization: `Bearer ${token(permissions)}`,
    [ACTIVE_HOTEL_HEADER_NAME]: HOTEL_ID,
  };
}

afterEach(async () => {
  while (appsToClose.length) await appsToClose.pop()!.close();
});

describe("maintenance routes", () => {
  it("nega acesso sem uma permissão de manutenção", async () => {
    const app = await appWith(repository());
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/maintenance/occurrences",
          headers: headers([PERMISSIONS.ROOM_READ]),
        })
      ).statusCode,
    ).toBe(403);
  });

  it("registra ocorrência de quarto sem atribuir responsabilidade", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "POST",
      url: "/admin/maintenance/occurrences",
      headers: headers([PERMISSIONS.MAINTENANCE_OCCURRENCE_CREATE]),
      payload: {
        category_id: CATEGORY_ID,
        room_id: ROOM_ID,
        kind: "damage",
        priority: "high",
        description: "Televisor com tela quebrada",
      },
    });
    expect(response.statusCode).toBe(201);
    expect(repo.createOccurrence).toHaveBeenCalledWith(
      HOTEL_ID,
      USER_ID,
      expect.objectContaining({ room_id: ROOM_ID }),
    );
  });

  it("rejeita ocorrência com quarto e local ao mesmo tempo", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "POST",
      url: "/admin/maintenance/occurrences",
      headers: headers([PERMISSIONS.MAINTENANCE_OCCURRENCE_CREATE]),
      payload: {
        category_id: CATEGORY_ID,
        room_id: ROOM_ID,
        location_id: "96000000-0000-4000-8000-000000000001",
        kind: "damage",
        description: "Alvo ambíguo",
      },
    });
    expect(response.statusCode).toBe(400);
    expect(repo.createOccurrence).not.toHaveBeenCalled();
  });

  it("isola a triagem em permissão própria", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const denied = await app.inject({
      method: "POST",
      url: `/admin/maintenance/occurrences/${OCCURRENCE_ID}/triage`,
      headers: headers([PERMISSIONS.MAINTENANCE_READ]),
      payload: { priority: "critical" },
    });
    const accepted = await app.inject({
      method: "POST",
      url: `/admin/maintenance/occurrences/${OCCURRENCE_ID}/triage`,
      headers: headers([PERMISSIONS.MAINTENANCE_TRIAGE]),
      payload: { priority: "critical" },
    });
    expect(denied.statusCode).toBe(403);
    expect(accepted.statusCode).toBe(200);
    expect(repo.updateOccurrence).toHaveBeenCalled();
  });

  it("propaga transição inválida como conflito", async () => {
    const repo = repository({
      transitionWorkOrder: vi.fn(async () => ({ result: "conflict" })),
    });
    const app = await appWith(repo);
    const response = await app.inject({
      method: "POST",
      url: "/admin/maintenance/work-orders/98000000-0000-4000-8000-000000000001/transition",
      headers: headers([PERMISSIONS.MAINTENANCE_EXECUTE]),
      payload: { action: "complete" },
    });
    expect(response.statusCode).toBe(409);
  });

  it("exige confirmação justificada quando há conflito de bloqueio", async () => {
    const repo = repository({
      createRoomBlock: vi.fn(async () => ({
        result: "conflict",
        conflicts: [
          {
            id: "stay",
            reservation_code: "A-1",
            checkin_date_expected: "2026-09-01",
            checkout_date_expected: "2026-09-03",
          },
        ],
      })),
    });
    const app = await appWith(repo);
    const response = await app.inject({
      method: "POST",
      url: `/admin/maintenance/occurrences/${OCCURRENCE_ID}/room-blocks`,
      headers: headers([PERMISSIONS.MAINTENANCE_BLOCK_MANAGE]),
      payload: { start_date: "2026-09-01", end_date: "2026-09-03" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("confirme ciência");
  });
});
