import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type SessionPayload } from "@hotel/shared";
import { registerAuthRoutes } from "../../../src/routes/authRoutes";
import { hashTemporaryPassword, verifyToken } from "../../../src/auth/session";
import type { AuthRepository } from "../../../src/repositories/authRepository";

const appsToClose: Array<ReturnType<typeof Fastify>> = [];

async function createAuthTestApp(repository: AuthRepository) {
  const app = Fastify({ logger: false });
  registerAuthRoutes(app, repository);
  await app.ready();
  appsToClose.push(app);
  return app;
}

afterEach(async () => {
  while (appsToClose.length) {
    await appsToClose.pop()!.close();
  }
});

describe("routes/auth with injected repository", () => {
  it("realiza login com sucesso usando repository injetado", async () => {
    const repository: AuthRepository = {
      findUserByEmail: vi.fn(async () => ({
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
        is_active: true,
        password_hash: hashTemporaryPassword("Secret#123"),
        user_roles: [
          {
            roles: {
              id: "role-1",
              name: "Administrador",
              hotel_id: null,
              hotels: { name: null },
              role_permissions: [{ permissions: { name: PERMISSIONS.USER_READ } }]
            }
          }
        ]
      })),
      markSuccessfulLogin: vi.fn(async () => undefined)
    };

    const app = await createAuthTestApp(repository);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "ADMIN@EXAMPLE.COM",
        password: "Secret#123"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(repository.findUserByEmail).toHaveBeenCalledWith("admin@example.com");
    expect(repository.markSuccessfulLogin).toHaveBeenCalledWith("user-1");

    const body = response.json() as {
      token: string;
      expiresIn: number;
      user: SessionPayload;
    };

    expect(body.expiresIn).toBeGreaterThan(0);
    expect(body.user.email).toBe("admin@example.com");
    expect(verifyToken(body.token)).not.toBeNull();
  });

  it("nao falha login quando atualizacao de ultimo acesso retorna erro", async () => {
    const repository: AuthRepository = {
      findUserByEmail: vi.fn(async () => ({
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
        is_active: true,
        password_hash: hashTemporaryPassword("Secret#123"),
        user_roles: []
      })),
      markSuccessfulLogin: vi.fn(async () => {
        throw new Error("write failure");
      })
    };

    const app = await createAuthTestApp(repository);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "admin@example.com",
        password: "Secret#123"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(repository.markSuccessfulLogin).toHaveBeenCalledWith("user-1");
  });
});