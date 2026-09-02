import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../src/auth/session";
import type { MaintenanceManagementRepository } from "../../src/repositories/maintenanceManagementRepository";
import type { MaintenanceRepository } from "../../src/repositories/maintenanceRepository";
import { registerMaintenanceManagementRoutes } from "../../src/routes/maintenanceManagementRoutes";

const HOTEL_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "80000000-0000-4000-8000-000000000002";
const OTHER_ID = "80000000-0000-4000-8000-000000000003";
const apps: Array<ReturnType<typeof Fastify>> = [];

function headers(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    id: USER_ID,
    name: "Gestor",
    email: "gestor@example.test",
    tenantId: null,
    roles: ["Gestor"],
    permissions,
    roleAssignments: [
      {
        roleId: "role",
        roleName: "Gestor",
        roleType: "HOTEL_ROLE",
        hotelId: HOTEL_ID,
        hotelName: "Hotel",
      },
    ],
    iat: now,
    exp: now + 3600,
  };
  return {
    authorization: `Bearer ${signToken(payload)}`,
    [ACTIVE_HOTEL_HEADER_NAME]: HOTEL_ID,
  };
}

function management(
  overrides: Partial<MaintenanceManagementRepository> = {},
): MaintenanceManagementRepository {
  return {
    listPlans: vi.fn(async () => []),
    getPlan: vi.fn(async () => null),
    savePlan: vi.fn(async () => ({ result: "conflict" })),
    setPlanStatus: vi.fn(async () => ({ result: "conflict" })),
    listRuns: vi.fn(async () => []),
    decideRun: vi.fn(async () => ({ result: "conflict" })),
    completeChecklist: vi.fn(async () => null),
    transitionSupplierWork: vi.fn(async () => null),
    listSlaPolicies: vi.fn(async () => []),
    createSlaPolicy: vi.fn(async () => ({ result: "conflict" })),
    updateSlaPolicy: vi.fn(async () => ({ result: "conflict" })),
    listSuppliers: vi.fn(async () => []),
    createSupplier: vi.fn(async () => ({ result: "conflict" })),
    updateSupplier: vi.fn(async () => ({ result: "conflict" })),
    createContact: vi.fn(async () => ({ result: "conflict" })),
    updateContact: vi.fn(async () => ({ result: "conflict" })),
    createContract: vi.fn(async () => ({ result: "conflict" })),
    updateContract: vi.fn(async () => ({ result: "conflict" })),
    listNotifications: vi.fn(async () => []),
    notificationSummary: vi.fn(async () => 0),
    setNotificationStatus: vi.fn(async () => true),
    readAllNotifications: vi.fn(async () => 0),
    analytics: vi.fn(async () => ({
      filters: {},
      backlog: 0,
      critical_open: 0,
      average_triage_hours: 0,
      average_resolution_hours: 0,
      sla_compliance_rate: 0,
      preventive_compliance_rate: 0,
      recurring_occurrences: 0,
      blocked_room_days: 0,
      supplier_completion_rate: 0,
      aging: [],
      series: [],
    })),
    exportRows: vi.fn(async () => []),
    listAutomationRuns: vi.fn(async () => []),
    runAutomation: vi.fn(async () => []),
    createDocumentUploadIntent: vi.fn(async () => ({
      storage_path: "path",
      token: "token",
      signed_url: "url",
    })),
    finalizeDocuments: vi.fn(async () => true),
    accessDocument: vi.fn(async () => null),
    removeDocument: vi.fn(async () => true),
    ...overrides,
  };
}

function maintenance(assignedTo = USER_ID): MaintenanceRepository {
  return {
    getWorkOrderAccess: vi.fn(async () => ({
      assignedTo,
      occurrenceId: "97000000-0000-4000-8000-000000000001",
    })),
    getOccurrence: vi.fn(async () => null),
  } as MaintenanceRepository;
}

async function appWith(
  repo: MaintenanceManagementRepository,
  core = maintenance(),
) {
  const app = Fastify({ logger: false });
  registerMaintenanceManagementRoutes(app, repo, core);
  await app.ready();
  apps.push(app);
  return app;
}

afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

describe("maintenance management routes", () => {
  it("exige uma permissão do módulo para a caixa de notificações", async () => {
    const app = await appWith(management());
    const response = await app.inject({
      method: "GET",
      url: "/admin/maintenance/notifications",
      headers: headers([PERMISSIONS.ROOM_READ]),
    });
    expect(response.statusCode).toBe(403);
  });

  it("isola a criação de plano na permissão específica", async () => {
    const savePlan = vi.fn(async () => ({ result: "conflict" as const }));
    const app = await appWith(management({ savePlan }));
    const denied = await app.inject({
      method: "POST",
      url: "/admin/maintenance/preventive-plans",
      headers: headers([PERMISSIONS.MAINTENANCE_EXECUTE]),
      payload: {},
    });
    expect(denied.statusCode).toBe(403);
    await app.inject({
      method: "POST",
      url: "/admin/maintenance/preventive-plans",
      headers: headers([PERMISSIONS.MAINTENANCE_PLAN_MANAGE]),
      payload: {},
    });
    expect(savePlan).toHaveBeenCalledOnce();
  });

  it("não permite que um executor altere checklist alheio", async () => {
    const completeChecklist = vi.fn(async () => "occurrence");
    const app = await appWith(
      management({ completeChecklist }),
      maintenance(OTHER_ID),
    );
    const response = await app.inject({
      method: "POST",
      url: "/admin/maintenance/work-orders/98000000-0000-4000-8000-000000000001/checklist/98100000-0000-4000-8000-000000000001/complete",
      headers: headers([PERMISSIONS.MAINTENANCE_EXECUTE]),
      payload: { completed: true },
    });
    expect(response.statusCode).toBe(403);
    expect(completeChecklist).not.toHaveBeenCalled();
  });

  it("escopa notificações pelo usuário autenticado", async () => {
    const listNotifications = vi.fn(async () => []);
    const app = await appWith(management({ listNotifications }));
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/maintenance/notifications?status=unread",
          headers: headers([PERMISSIONS.MAINTENANCE_EXECUTE]),
        })
      ).statusCode,
    ).toBe(200);
    expect(listNotifications).toHaveBeenCalledWith(
      HOTEL_ID,
      USER_ID,
      expect.objectContaining({ status: "unread" }),
    );
  });

  it("só solicita métricas financeiras quando a leitura financeira também existe", async () => {
    const analytics = vi.fn(async () => ({
      filters: {},
      backlog: 0,
      critical_open: 0,
      average_triage_hours: 0,
      average_resolution_hours: 0,
      sla_compliance_rate: 0,
      preventive_compliance_rate: 0,
      recurring_occurrences: 0,
      blocked_room_days: 0,
      supplier_completion_rate: 0,
      aging: [],
      series: [],
    }));
    const app = await appWith(management({ analytics }));
    await app.inject({
      method: "GET",
      url: "/admin/maintenance/analytics",
      headers: headers([PERMISSIONS.MAINTENANCE_ANALYTICS_READ]),
    });
    await app.inject({
      method: "GET",
      url: "/admin/maintenance/analytics",
      headers: headers([
        PERMISSIONS.MAINTENANCE_ANALYTICS_READ,
        PERMISSIONS.MAINTENANCE_FINANCE_READ,
      ]),
    });
    expect(analytics.mock.calls[0]?.[2]).toBe(false);
    expect(analytics.mock.calls[1]?.[2]).toBe(true);
  });
});
