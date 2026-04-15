import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_ROLE_TYPES, PERMISSIONS, type SessionPayload } from "@hotel/shared";
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
    findPermissionsByIds: vi.fn(async () => []),
    createRoleWithPermissions: vi.fn(async () => ({ result: "ok", id: "role-2" })),
    createRole: vi.fn(async () => ({ result: "ok", id: "role-2" })),
    assignRolePermissions: vi.fn(async () => undefined),
    getRoleWithRelationsById: vi.fn(async () => ({
      id: "role-2",
      name: "Supervisor",
      role_type: "SYSTEM_ROLE",
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
      findPermissionsByIds: vi.fn(async () => [
        { id: "perm-1", type: "SYSTEM_PERMISSION" },
        { id: "perm-2", type: "SYSTEM_PERMISSION" }
      ])
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
        role_type: ADMIN_ROLE_TYPES.SYSTEM,
        hotel_id: null,
        permission_ids: ["perm-1", "perm-2"]
      }
    });

    expect(response.statusCode).toBe(201);
    expect(repository.createRoleWithPermissions).toHaveBeenCalledWith(
      {
        name: "Supervisor",
        role_type: ADMIN_ROLE_TYPES.SYSTEM,
        hotel_id: null
      },
      ["perm-1", "perm-2"]
    );
  });

  it("retorna 400 quando role de sistema recebe permissao de hotel", async () => {
    const repository = createRolesRepositoryMock({
      findPermissionsByIds: vi.fn(async () => [{ id: "perm-1", type: "HOTEL_PERMISSION" }])
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
        role_type: ADMIN_ROLE_TYPES.SYSTEM,
        hotel_id: null,
        permission_ids: ["perm-1"]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: "Role de sistema aceita apenas permissoes do tipo SYSTEM_PERMISSION."
    });
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
        role_type: ADMIN_ROLE_TYPES.SYSTEM,
        hotel_id: null,
        permission_ids: []
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ message: "Nome de role ja existente." });
  });

  it("retorna 409 quando delete de role sinaliza conflito", async () => {
    const repository = createRolesRepositoryMock({
      deleteRole: vi.fn(async () => "conflict")
    });

    const app = await createRolesTestApp(repository);

    const response = await app.inject({
      method: "DELETE",
      url: "/admin/roles/role-1",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.ROLE_DELETE])}`
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ message: "Role nao pode ser excluida: possui dependencias ativas." });
  });

  it("retorna 200 quando delete de role e concluido", async () => {
    const repository = createRolesRepositoryMock({
      deleteRole: vi.fn(async () => "ok")
    });

    const app = await createRolesTestApp(repository);

    const response = await app.inject({
      method: "DELETE",
      url: "/admin/roles/role-1",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.ROLE_DELETE])}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("retorna 404 quando role nao existe no delete", async () => {
    const repository = createRolesRepositoryMock({
      deleteRole: vi.fn(async () => "not-found")
    });

    const app = await createRolesTestApp(repository);

    const response = await app.inject({
      method: "DELETE",
      url: "/admin/roles/role-inexistente",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.ROLE_DELETE])}`
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ message: "Role nao encontrada." });
  });
});
