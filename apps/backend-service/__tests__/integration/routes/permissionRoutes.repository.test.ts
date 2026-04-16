import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type SessionPayload } from "@hotel/shared";
import { signToken } from "../../../src/auth/session";
import { registerPermissionRoutes } from "../../../src/routes/permissionRoutes";
import type { PermissionsRepository } from "../../../src/repositories/permissionsRepository";

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
    roleAssignments: [{ roleId: "role-system", roleName: "Admin", roleType: "SYSTEM_ROLE", hotelId: null, hotelName: null }],
    iat: nowInSeconds,
    exp: nowInSeconds + 3600
  };

  return signToken(payload);
}

function createPermissionsRepositoryMock(overrides: Partial<PermissionsRepository> = {}): PermissionsRepository {
  return {
    listPermissions: vi.fn(async () => []),
    getPermissionById: vi.fn(async (id: string) => ({ id, name: "perm_name", type: "SYSTEM_PERMISSION" })),
    createPermission: vi.fn(async () => ({ result: "ok", item: { id: "perm-1", name: "perm_name", type: "SYSTEM_PERMISSION" } })),
    updatePermission: vi.fn(async () => ({ result: "ok", item: { id: "perm-1", name: "perm_name", type: "SYSTEM_PERMISSION" } })),
    deletePermission: vi.fn(async () => "ok"),
    ...overrides
  };
}

async function createPermissionsTestApp(repository: PermissionsRepository) {
  const app = Fastify({ logger: false });
  registerPermissionRoutes(app, repository);
  await app.ready();
  appsToClose.push(app);
  return app;
}

afterEach(async () => {
  while (appsToClose.length) {
    await appsToClose.pop()!.close();
  }
});

describe("routes/permissions with injected repository", () => {
  it("bloqueia exclusao de permissao vinculada ao proprio usuario", async () => {
    const repository = createPermissionsRepositoryMock({
      getPermissionById: vi.fn(async () => ({ id: "perm-1", name: "perm_name", type: "SYSTEM_PERMISSION" }))
    });

    const app = await createPermissionsTestApp(repository);
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const token = signToken({
      id: "user-1",
      name: "Admin",
      email: "admin@example.com",
      tenantId: null,
      roles: ["Admin"],
      permissions: [PERMISSIONS.PERMISSION_DELETE, "perm_name"],
      roleAssignments: [
        {
          roleId: "role-system",
          roleName: "Admin",
          roleType: "SYSTEM_ROLE",
          hotelId: null,
          hotelName: null,
          permissions: ["perm_name"]
        }
      ],
      iat: nowInSeconds,
      exp: nowInSeconds + 3600
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/admin/permissions/perm-1",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      code: "ADMIN_SELF_ACTION_FORBIDDEN",
      message: "Nao e permitido excluir uma permissao vinculada ao proprio usuario."
    });
    expect(repository.deletePermission).not.toHaveBeenCalled();
  });

  it("retorna 409 quando delete de permissao sinaliza conflito", async () => {
    const repository = createPermissionsRepositoryMock({
      deletePermission: vi.fn(async () => "conflict")
    });

    const app = await createPermissionsTestApp(repository);

    const response = await app.inject({
      method: "DELETE",
      url: "/admin/permissions/perm-1",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.PERMISSION_DELETE])}`
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ code: "ADMIN_CONFLICT", message: "Permissao nao pode ser excluida: possui dependencias ativas." });
  });
});
