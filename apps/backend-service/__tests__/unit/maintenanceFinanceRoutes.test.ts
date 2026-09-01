import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type AdminMaintenanceCostItem,
  type AdminMaintenanceFinanceOccurrence,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../src/auth/session";
import type { MaintenanceFinanceRepository } from "../../src/repositories/maintenanceFinanceRepository";
import { registerMaintenanceFinanceRoutes } from "../../src/routes/maintenanceFinanceRoutes";

const HOTEL_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "80000000-0000-4000-8000-000000000002";
const OCCURRENCE_ID = "97000000-0000-4000-8000-000000000002";
const ITEM_ID = "99000000-0000-4000-8000-000000000001";
const apps: Array<ReturnType<typeof Fastify>> = [];

function headers(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    id: USER_ID,
    name: "Gestor",
    email: "gestor@example.com",
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

const cost: AdminMaintenanceCostItem = {
  id: ITEM_ID,
  occurrence_id: OCCURRENCE_ID,
  work_order_id: null,
  kind: "material",
  description: "Substituição de item",
  quantity: 1,
  estimated_amount: 100,
  actual_amount: 90,
  currency: "BRL",
  counterparty: null,
  due_date: null,
  reference_code: null,
  approval_status: "submitted",
  settlement_status: "not_posted",
  created_by: USER_ID,
  submitted_at: "2026-08-31T00:00:00.000Z",
  approved_by: null,
  approved_at: null,
  decision_reason: null,
  settled_amount: 0,
  outstanding_amount: 90,
  settlements: [],
  attachments: [],
  created_at: "2026-08-31T00:00:00.000Z",
  updated_at: "2026-08-31T00:00:00.000Z",
};
const occurrenceFinance: AdminMaintenanceFinanceOccurrence = {
  occurrence_id: OCCURRENCE_ID,
  currency: "BRL",
  estimated_cost: 100,
  approved_cost: 0,
  settled_cost: 0,
  approved_recovery: 0,
  received_recovery: 0,
  net_result: 0,
  cost_items: [cost],
  recoveries: [],
};

function repository(
  overrides: Partial<MaintenanceFinanceRepository> = {},
): MaintenanceFinanceRepository {
  return {
    getStayFolio: vi.fn(async () => null),
    previewStayAllocation: vi.fn(async () => null),
    createStayPayment: vi.fn(async () => ({ result: "not-found" })),
    getOccurrenceFinance: vi.fn(async () => occurrenceFinance),
    getSummary: vi.fn(async () => ({
      currency: "BRL",
      awaiting_approval: 1,
      payable: 0,
      receivable: 0,
      overdue: 0,
      settled: 0,
      payable_amount: 0,
      receivable_amount: 0,
    })),
    listItems: vi.fn(async () => ({
      items: [cost],
      page: 1,
      page_size: 25,
      total: 1,
    })),
    createCostItem: vi.fn(async () => ({ result: "ok", item: cost })),
    updateCostItem: vi.fn(async () => ({ result: "ok", item: cost })),
    transitionCostItem: vi.fn(async () => ({ result: "ok", item: cost })),
    settleCostItem: vi.fn(async () => ({ result: "ok", item: cost })),
    createRecovery: vi.fn(async () => ({ result: "conflict" })),
    updateRecovery: vi.fn(async () => ({ result: "conflict" })),
    transitionRecovery: vi.fn(async () => ({ result: "conflict" })),
    settleRecovery: vi.fn(async () => ({ result: "conflict" })),
    reverseSettlement: vi.fn(async () => ({
      result: "ok",
      item: occurrenceFinance,
    })),
    countAttachments: vi.fn(async () => 0),
    createUploadIntent: vi.fn(async () => ({
      storage_path: "path",
      token: "token",
      signed_url: "url",
    })),
    finalizeAttachments: vi.fn(async () => ({
      result: "ok",
      item: occurrenceFinance,
    })),
    createAttachmentAccess: vi.fn(async () => ({
      signed_url: "url",
      expires_in: 300,
    })),
    removeAttachment: vi.fn(async () => ({
      result: "ok",
      item: occurrenceFinance,
    })),
    ...overrides,
  };
}

async function appWith(repo: MaintenanceFinanceRepository) {
  const app = Fastify({ logger: false });
  registerMaintenanceFinanceRoutes(app, repo);
  await app.ready();
  apps.push(app);
  return app;
}

afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

describe("maintenance finance routes", () => {
  it("não revela valores sem permissão financeira", async () => {
    const app = await appWith(repository());
    const response = await app.inject({
      method: "GET",
      url: "/admin/maintenance/finance/summary",
      headers: headers([PERMISSIONS.MAINTENANCE_READ]),
    });
    expect(response.statusCode).toBe(403);
  });

  it("lista a fila apenas com a permissão de leitura financeira", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "GET",
      url: "/admin/maintenance/finance/items?queue=approval",
      headers: headers([PERMISSIONS.MAINTENANCE_FINANCE_READ]),
    });
    expect(response.statusCode).toBe(200);
    expect(repo.listItems).toHaveBeenCalledWith(
      HOTEL_ID,
      expect.objectContaining({ queue: "approval" }),
    );
  });

  it("separa permissão de proposta e aprovação", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const body = { action: "approve" };
    const denied = await app.inject({
      method: "POST",
      url: `/admin/maintenance/cost-items/${ITEM_ID}/transition`,
      headers: headers([PERMISSIONS.MAINTENANCE_FINANCE_PROPOSE]),
      payload: body,
    });
    const allowed = await app.inject({
      method: "POST",
      url: `/admin/maintenance/cost-items/${ITEM_ID}/transition`,
      headers: headers([PERMISSIONS.MAINTENANCE_FINANCE_APPROVE]),
      payload: body,
    });
    expect(denied.statusCode).toBe(403);
    expect(allowed.statusCode).toBe(200);
    expect(repo.transitionCostItem).toHaveBeenCalledWith(
      HOTEL_ID,
      ITEM_ID,
      USER_ID,
      "approve",
      undefined,
    );
  });

  it("exige permissão de liquidação para pagamentos e estornos", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const denied = await app.inject({
      method: "POST",
      url: `/admin/maintenance/cost-items/${ITEM_ID}/settlements`,
      headers: headers([PERMISSIONS.MAINTENANCE_FINANCE_APPROVE]),
      payload: { amount: 10, method: "pix" },
    });
    const allowed = await app.inject({
      method: "POST",
      url: "/admin/maintenance/finance/settlements/99200000-0000-4000-8000-000000000001/reverse",
      headers: headers([PERMISSIONS.MAINTENANCE_FINANCE_SETTLE]),
      payload: { reason: "Pagamento duplicado" },
    });
    expect(denied.statusCode).toBe(403);
    expect(allowed.statusCode).toBe(200);
    expect(repo.reverseSettlement).toHaveBeenCalled();
  });

  it("protege documentos e exige motivo para removê-los", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const denied = await app.inject({
      method: "POST",
      url: `/admin/maintenance/financial-attachments/${ITEM_ID}/access`,
      headers: headers([PERMISSIONS.MAINTENANCE_READ]),
    });
    const invalid = await app.inject({
      method: "POST",
      url: `/admin/maintenance/financial-attachments/${ITEM_ID}/remove`,
      headers: headers([PERMISSIONS.MAINTENANCE_FINANCE_PROPOSE]),
      payload: { reason: " " },
    });
    const allowed = await app.inject({
      method: "POST",
      url: `/admin/maintenance/financial-attachments/${ITEM_ID}/remove`,
      headers: headers([PERMISSIONS.MAINTENANCE_FINANCE_PROPOSE]),
      payload: { reason: "Documento duplicado" },
    });
    expect(denied.statusCode).toBe(403);
    expect(invalid.statusCode).toBe(400);
    expect(allowed.statusCode).toBe(200);
    expect(repo.removeAttachment).toHaveBeenCalledWith(
      HOTEL_ID,
      ITEM_ID,
      USER_ID,
      "Documento duplicado",
    );
  });
});
