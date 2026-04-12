import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_PAGE_ERROR_PARAM } from "@hotel/shared";

const { redirectMock, loginWithCredentialsMock, saveSessionCookieMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  loginWithCredentialsMock: vi.fn(),
  saveSessionCookieMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("../../../src/lib/auth", () => ({
  loginWithCredentials: loginWithCredentialsMock,
  saveSessionCookie: saveSessionCookieMock
}));

import { loginAction } from "../../../src/app/login/actions";

describe("login/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redireciona para missing_fields quando formulario e invalido", async () => {
    const formData = new FormData();

    await expect(loginAction(formData)).rejects.toThrow(
      `REDIRECT:/login?error=${LOGIN_PAGE_ERROR_PARAM.MISSING_FIELDS}`
    );

    expect(loginWithCredentialsMock).not.toHaveBeenCalled();
  });

  it("redireciona para invalid_credentials quando autenticacao falha", async () => {
    loginWithCredentialsMock.mockRejectedValueOnce(new Error("invalid"));

    const formData = new FormData();
    formData.set("email", "admin@example.com");
    formData.set("password", "wrong-pass");

    await expect(loginAction(formData)).rejects.toThrow(
      `REDIRECT:/login?error=${LOGIN_PAGE_ERROR_PARAM.INVALID_CREDENTIALS}`
    );

    expect(loginWithCredentialsMock).toHaveBeenCalledWith("admin@example.com", "wrong-pass");
    expect(saveSessionCookieMock).not.toHaveBeenCalled();
  });

  it("salva cookie e redireciona para dashboard no login bem-sucedido", async () => {
    loginWithCredentialsMock.mockResolvedValueOnce({
      token: "token-123",
      expiresIn: 3600,
      user: {
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
        tenantId: null,
        roles: ["Admin"],
        permissions: [],
        roleAssignments: []
      }
    });

    const formData = new FormData();
    formData.set("email", "admin@example.com");
    formData.set("password", "Secret#123");

    await expect(loginAction(formData)).rejects.toThrow("REDIRECT:/dashboard");

    expect(saveSessionCookieMock).toHaveBeenCalledWith("token-123", 3600);
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});