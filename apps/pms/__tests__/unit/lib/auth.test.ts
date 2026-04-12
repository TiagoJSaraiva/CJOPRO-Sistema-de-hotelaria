import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn()
  }))
}));

import { loginWithCredentials } from "../../../src/lib/auth";

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
