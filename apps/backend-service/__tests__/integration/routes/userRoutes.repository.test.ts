import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type SessionPayload } from "@hotel/shared";
import { registerUserRoutes } from "../../../src/routes/userRoutes";
import type { UsersRepository } from "../../../src/repositories/usersRepository";
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

function createUsersRepositoryMock(overrides: Partial<UsersRepository> = {}): UsersRepository {
  return {
    listReferenceHotels: vi.fn(async () => []),
    listReferenceRoles: vi.fn(async () => []),
    listUsersWithRelations: vi.fn(async () => []),
    findRolesByIds: vi.fn(async () => []),
    createUserWithRoles: vi.fn(async () => ({ result: "ok", id: "user-2" })),
    createUser: vi.fn(async () => ({ result: "ok", id: "user-2" })),
    assignUserRoles: vi.fn(async () => undefined),
    getUserWithRelationsById: vi.fn(async () => ({
      id: "user-2",
      name: "Operador",
      email: "op@hotel.com",
      is_active: true,
      last_login_at: null,
      created_at: null,
      user_roles: [
        {
          roles: {
            id: "role-1",
            name: "Operador",
            hotel_id: null,
            hotels: { name: null }
          }
        }
      ]
    })),
    updateUserWithRoles: vi.fn(async () => "ok"),
    updateUser: vi.fn(async () => "ok"),
    userExists: vi.fn(async () => true),
    clearUserRoles: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => "ok"),
    ...overrides
  };
}

async function createUsersTestApp(repository: UsersRepository) {
  const app = Fastify({ logger: false });
  registerUserRoutes(app, repository);
  await app.ready();
  appsToClose.push(app);
  return app;
}

afterEach(async () => {
  while (appsToClose.length) {
    await appsToClose.pop()!.close();
  }
});

describe("routes/users with injected repository", () => {
  it("cria usuario com operacao atomica de papeis", async () => {
    const repository = createUsersRepositoryMock({
      findRolesByIds: vi.fn(async () => [
        {
          id: "role-1",
          name: "Operador",
          hotel_id: null,
          hotels: { name: null }
        }
      ])
    });

    const app = await createUsersTestApp(repository);

    const response = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.USER_CREATE])}`
      },
      payload: {
        name: "Operador",
        email: "op@hotel.com",
        password_hash: "Secret#123",
        role_assignments: [{ role_id: "role-1", hotel_id: null }]
      }
    });

    expect(response.statusCode).toBe(201);
    expect(repository.createUserWithRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Operador",
        email: "op@hotel.com",
        is_active: true
      }),
      ["role-1"]
    );
  });

  it("retorna 409 quando operacao atomica de criacao sinaliza conflito", async () => {
    const repository = createUsersRepositoryMock({
      createUserWithRoles: vi.fn(async () => ({ result: "conflict" }))
    });

    const app = await createUsersTestApp(repository);

    const response = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.USER_CREATE])}`
      },
      payload: {
        name: "Operador",
        email: "op@hotel.com",
        password_hash: "Secret#123",
        role_assignments: []
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ message: "Email ja utilizado por outro usuario." });
  });
});
