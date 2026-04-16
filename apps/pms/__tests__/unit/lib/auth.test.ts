import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn()
  }))
}));

import { getUserFromSession, loginWithCredentials } from "../../../src/lib/auth";
import { cookies } from "next/headers";

describe("lib/auth - loginWithCredentials", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("retorna token e usuario quando backend autentica", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "token-abc",
          expiresIn: 3600,
          user: {
            id: "user-1",
            name: "Admin",
            email: "admin@hotel.com",
            tenantId: null,
            roles: ["Admin"],
            permissions: ["read_hotel"],
            roleAssignments: []
          }
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await loginWithCredentials("admin@hotel.com", "secret");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toEqual({
      token: "token-abc",
      expiresIn: 3600,
      user: {
        id: "user-1",
        name: "Admin",
        email: "admin@hotel.com",
        tenantId: null,
        roles: ["Admin"],
        permissions: ["read_hotel"],
        roleAssignments: []
      }
    });
  });

  it("retorna erro amigavel quando backend esta indisponivel", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(loginWithCredentials("admin@hotel.com", "secret")).rejects.toThrow(
      "Servico de autenticacao indisponivel no momento."
    );
  });
});

describe("lib/auth - getUserFromSession", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("envia header de hotel ativo quando cookie existe", async () => {
    const getMock = vi.fn((name: string) => {
      if (name === "pms_session_token") {
        return { value: "token-abc" };
      }

      if (name === "pms_active_hotel") {
        return { value: "hotel-1" };
      }

      return undefined;
    });

    vi.mocked(cookies).mockReturnValue({ get: getMock } as any);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: "user-1",
            name: "Admin",
            email: "admin@hotel.com",
            tenantId: null,
            roles: ["Gestor"],
            permissions: ["user_read"],
            roleAssignments: []
          }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const user = await getUserFromSession();

    expect(user?.id).toBe("user-1");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3334/auth/me", {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: "Bearer token-abc",
        "x-active-hotel-id": "hotel-1"
      }
    });
  });

  it("nao envia header de hotel quando cookie de contexto nao existe", async () => {
    const getMock = vi.fn((name: string) => {
      if (name === "pms_session_token") {
        return { value: "token-abc" };
      }

      return undefined;
    });

    vi.mocked(cookies).mockReturnValue({ get: getMock } as any);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    await getUserFromSession();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3334/auth/me", {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: "Bearer token-abc"
      }
    });
  });
});
