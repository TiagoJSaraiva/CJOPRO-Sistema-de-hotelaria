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
    roleAssignments: [],
    iat: nowInSeconds,
    exp: nowInSeconds + 3600
  };

  return signToken(payload);
}

function createPermissionsRepositoryMock(overrides: Partial<PermissionsRepository> = {}): PermissionsRepository {
  return {
    listPermissions: vi.fn(async () => []),
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
    expect(response.json()).toEqual({ message: "Permissao nao pode ser excluida: possui dependencias ativas." });
  });
});
