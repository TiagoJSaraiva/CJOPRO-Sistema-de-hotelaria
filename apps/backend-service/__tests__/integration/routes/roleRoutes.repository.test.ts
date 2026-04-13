import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type SessionPayload } from "@hotel/shared";
import { registerRoleRoutes } from "../../../src/routes/roleRoutes";
import type { RolesRepository } from "../../../src/repositories/rolesRepository";
import { signToken } from "../../../src/auth/session";

const appsToClose: Array<ReturnType<typeof Fastify>> = [];

function createToken(permissions: string[]): string {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  const payload: SessionPayload = {
    id: "user-1",
    name: "Admin",
    email: "admin@example.com",
    tenantId: null,
    roles: ["Admin"],
    permissions,
    roleAssignments: [],
    iat: nowInSeconds,
    exp: nowInSeconds + 3600
  };

  return signToken(payload);
}

function createRolesRepositoryMock(overrides: Partial<RolesRepository> = {}): RolesRepository {
  return {
    listReferenceHotels: vi.fn(async () => []),
    listReferencePermissions: vi.fn(async () => []),
    listRolesWithRelations: vi.fn(async () => []),
    hotelExists: vi.fn(async () => true),
    countPermissionsByIds: vi.fn(async () => 0),
    createRoleWithPermissions: vi.fn(async () => ({ result: "ok", id: "role-2" })),
    createRole: vi.fn(async () => ({ result: "ok", id: "role-2" })),
    assignRolePermissions: vi.fn(async () => undefined),
    getRoleWithRelationsById: vi.fn(async () => ({
      id: "role-2",
      name: "Supervisor",
      hotel_id: null,
      hotels: { name: null },
      role_permissions: []
    })),
    updateRoleWithPermissions: vi.fn(async () => "ok"),
    updateRole: vi.fn(async () => "ok"),
    roleExists: vi.fn(async () => true),
    clearRolePermissions: vi.fn(async () => undefined),
    deleteRole: vi.fn(async () => "ok"),
    ...overrides
  };
}

async function createRolesTestApp(repository: RolesRepository) {
  const app = Fastify({ logger: false });
  registerRoleRoutes(app, repository);
  await app.ready();
  appsToClose.push(app);
  return app;
}

afterEach(async () => {
  while (appsToClose.length) {
    await appsToClose.pop()!.close();
  }
});

describe("routes/roles with injected repository", () => {
  it("cria role com operacao atomica de permissoes", async () => {
    const repository = createRolesRepositoryMock({
      countPermissionsByIds: vi.fn(async () => 2)
    });

    const app = await createRolesTestApp(repository);

    const response = await app.inject({
      method: "POST",
      url: "/admin/roles",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.ROLE_CREATE])}`
      },
      payload: {
        name: "Supervisor",
        hotel_id: null,
        permission_ids: ["perm-1", "perm-2"]
      }
    });

    expect(response.statusCode).toBe(201);
    expect(repository.createRoleWithPermissions).toHaveBeenCalledWith(
      {
        name: "Supervisor",
        hotel_id: null
      },
      ["perm-1", "perm-2"]
    );
  });

  it("retorna 409 quando operacao atomica de role sinaliza conflito", async () => {
    const repository = createRolesRepositoryMock({
      createRoleWithPermissions: vi.fn(async () => ({ result: "conflict" }))
    });

    const app = await createRolesTestApp(repository);

    const response = await app.inject({
      method: "POST",
      url: "/admin/roles",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.ROLE_CREATE])}`
      },
      payload: {
        name: "Supervisor",
        hotel_id: null,
        permission_ids: []
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ message: "Nome de role ja existente." });
  });
});
