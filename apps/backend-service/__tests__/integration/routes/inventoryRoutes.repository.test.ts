import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type AdminInventoryPosition,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../../src/auth/session";
import type { InventoryRepository } from "../../../src/repositories/inventoryRepository";
import { registerInventoryRoutes } from "../../../src/routes/inventoryRoutes";

const hotelId = "10000000-0000-4000-8000-000000000001";
const positionId = "a6000000-0000-4000-8000-000000000001";
const apps: ReturnType<typeof Fastify>[] = [];
const position = {
  id: positionId,
  hotel_id: hotelId,
  product: {
    id: "40000000-0000-4000-8000-000000000001",
    name: "Água",
    internal_code: "AGUA",
    kind: "physical",
    sales_unit: "unit",
    provider: { type: "hotel", partner: null },
  },
  location: {
    id: "a6000000-0000-4000-8000-000000000002",
    name: "Central",
    internal_code: "CENTRAL",
    is_active: true,
    archived_at: null,
  },
  quantity: 3,
  version: 2,
  minimum_quantity: 5,
  ideal_quantity: 10,
  suggested_replenishment: 7,
  average_unit_cost: 2,
  inventory_value: 6,
  status: "low",
  is_active: true,
  archived_at: null,
  updated_at: new Date().toISOString(),
} as AdminInventoryPosition;

function token(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  return signToken({
    id: "80000000-0000-4000-8000-000000000002",
    name: "Gerente",
    email: "gerente@example.com",
    tenantId: null,
    roles: ["Gerente"],
    permissions,
    roleAssignments: [
      {
        roleId: "role",
        roleName: "Gerente",
        roleType: "HOTEL_ROLE",
        hotelId,
        hotelName: "Hotel",
      },
    ] as SessionPayload["roleAssignments"],
    iat: now,
    exp: now + 3600,
  });
}
function headers(permissions: string[]) {
  return {
    authorization: `Bearer ${token(permissions)}`,
    [ACTIVE_HOTEL_HEADER_NAME]: hotelId,
  };
}
function repository(): InventoryRepository {
  return {
    getSettings: vi.fn(async () => ({
      hotel_id: hotelId,
      negative_stock_policy: "allow_with_warning",
      updated_at: new Date().toISOString(),
    })),
    updateSettings: vi.fn(async () => ({
      hotel_id: hotelId,
      negative_stock_policy: "block",
      updated_at: new Date().toISOString(),
    })),
    listLocations: vi.fn(async () => []),
    createLocation: vi.fn(async () => ({ result: "conflict" })),
    updateLocation: vi.fn(async () => ({ result: "not_found" })),
    reorderLocations: vi.fn(async () => "ok"),
    listPositions: vi.fn(async (_hotel, _filters, includeCosts) => [
      {
        ...position,
        ...(includeCosts
          ? {}
          : { average_unit_cost: undefined, inventory_value: undefined }),
      },
    ]),
    createPosition: vi.fn(async () => ({
      result: "ok",
      item: position,
      created: true,
    })),
    updatePosition: vi.fn(async () => ({ result: "ok", item: position })),
    postDocument: vi.fn(async () => ({
      result: "ok",
      id: "a6000000-0000-4000-8000-000000000004",
      created: true,
    })),
    transfer: vi.fn(async () => ({
      result: "ok",
      id: "a6000000-0000-4000-8000-000000000005",
      created: true,
    })),
    listMovements: vi.fn(async () => ({ items: [], next_cursor: null })),
    listAudit: vi.fn(async () => ({ items: [], next_cursor: null })),
    listCounts: vi.fn(async () => []),
    createCount: vi.fn(async () => ({ result: "count_without_items" })),
    updateCount: vi.fn(async () => ({ result: "count_version_conflict" })),
    completeCount: vi.fn(async () => ({ result: "count_version_conflict" })),
    cancelCount: vi.fn(async () => ({ result: "not_found" })),
  };
}
async function appWith(repo: InventoryRepository) {
  const app = Fastify();
  registerInventoryRoutes(app, repo);
  await app.ready();
  apps.push(app);
  return app;
}
afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

describe("inventory routes", () => {
  it("requires authentication and explicit permission, resolving the sole hotel scope", async () => {
    const app = await appWith(repository());
    expect(
      (await app.inject({ method: "GET", url: "/admin/inventory/overview" }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/inventory/overview",
          headers: headers([PERMISSIONS.PRODUCT_READ]),
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/inventory/overview",
          headers: {
            authorization: `Bearer ${token([PERMISSIONS.INVENTORY_READ])}`,
          },
        })
      ).statusCode,
    ).toBe(200);
  });

  it("scopes reads to the hotel and hides costs without cost permission", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const response = await app.inject({
      method: "GET",
      url: "/admin/inventory/overview?low_only=true",
      headers: headers([PERMISSIONS.INVENTORY_READ]),
    });
    expect(response.statusCode).toBe(200);
    expect(repo.listPositions).toHaveBeenCalledWith(
      hotelId,
      expect.objectContaining({ lowOnly: true }),
      false,
    );
    expect(response.json().items[0].average_unit_cost).toBeUndefined();
  });

  it("allows costs only with read_inventory_costs", async () => {
    const repo = repository();
    const app = await appWith(repo);
    await app.inject({
      method: "GET",
      url: "/admin/inventory/overview",
      headers: headers([
        PERMISSIONS.INVENTORY_READ,
        PERMISSIONS.INVENTORY_COSTS_READ,
      ]),
    });
    expect(repo.listPositions).toHaveBeenCalledWith(
      hotelId,
      expect.any(Object),
      true,
    );
  });

  it("validates documents and protects movement permissions", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const body = {
      kind: "receipt",
      reason: "Entrada",
      occurred_at: new Date().toISOString(),
      idempotency_key: "a6000000-0000-4000-8000-000000000010",
      lines: [{ position_id: positionId, quantity: 2 }],
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/admin/inventory/documents",
          headers: headers([PERMISSIONS.INVENTORY_READ]),
          payload: body,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/admin/inventory/documents",
          headers: headers([PERMISSIONS.INVENTORY_MOVEMENTS_POST]),
          payload: {
            ...body,
            lines: [{ position_id: positionId, quantity: 1.5 }],
          },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/admin/inventory/documents",
          headers: headers([PERMISSIONS.INVENTORY_MOVEMENTS_POST]),
          payload: body,
        })
      ).statusCode,
    ).toBe(201);
    expect(repo.postDocument).toHaveBeenCalledWith(
      hotelId,
      expect.any(String),
      body,
    );
  });

  it("maps stale counts and location conflicts without leaking other hotels", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const count = await app.inject({
      method: "POST",
      url: `/admin/inventory/counts/${positionId}/complete`,
      headers: headers([PERMISSIONS.INVENTORY_COUNTS_PERFORM]),
    });
    expect(count.statusCode).toBe(409);
    expect(count.json().details).toBe("count_version_conflict");
    const location = await app.inject({
      method: "PUT",
      url: `/admin/inventory/locations/${positionId}`,
      headers: headers([PERMISSIONS.INVENTORY_SETTINGS_MANAGE]),
      payload: { name: "Outro" },
    });
    expect(location.statusCode).toBe(404);
  });

  it("reorders locations atomically and exposes the audit trail", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const orderedIds = [
      "a6000000-0000-4000-8000-000000000002",
      "a6000000-0000-4000-8000-000000000003",
    ];
    const reorder = await app.inject({
      method: "PUT",
      url: "/admin/inventory/locations/order",
      headers: headers([PERMISSIONS.INVENTORY_SETTINGS_MANAGE]),
      payload: { ids: orderedIds },
    });
    expect(reorder.statusCode).toBe(200);
    expect(repo.reorderLocations).toHaveBeenCalledWith(
      hotelId,
      expect.any(String),
      orderedIds,
    );

    const audit = await app.inject({
      method: "GET",
      url: "/admin/inventory/audit?limit=25",
      headers: headers([PERMISSIONS.INVENTORY_READ]),
    });
    expect(audit.statusCode).toBe(200);
    expect(repo.listAudit).toHaveBeenCalledWith(hotelId, {
      cursor: undefined,
      limit: 25,
    });
  });
});
