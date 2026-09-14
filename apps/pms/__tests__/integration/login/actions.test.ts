import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOGIN_PAGE_ERROR_PARAM } from "@hotel/shared";

const {
  redirectMock,
  loginWithCredentialsMock,
  saveSessionCookieMock,
  getActiveHotelCookieValueMock,
  resolveActiveHotelForUserMock,
  saveActiveHotelCookieMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  loginWithCredentialsMock: vi.fn(),
  saveSessionCookieMock: vi.fn(),
  getActiveHotelCookieValueMock: vi.fn(),
  resolveActiveHotelForUserMock: vi.fn(),
  saveActiveHotelCookieMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("../../../src/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/auth")>()),
  loginWithCredentials: loginWithCredentialsMock,
  saveSessionCookie: saveSessionCookieMock,
}));

vi.mock("../../../src/lib/activeHotel", () => ({
  getActiveHotelCookieValue: getActiveHotelCookieValueMock,
  resolveActiveHotelForUser: resolveActiveHotelForUserMock,
  saveActiveHotelCookie: saveActiveHotelCookieMock,
}));

import { loginAction } from "../../../src/app/login/actions";
import { SessionTooLargeError } from "../../../src/lib/auth";

describe("login/actions", () => {
  it("informa falha de sessão sem confundir com credenciais inválidas", async () => {
    loginWithCredentialsMock.mockResolvedValueOnce({
      token: "oversized",
      expiresIn: 28800,
      user: {},
    });
    saveSessionCookieMock.mockRejectedValueOnce(new SessionTooLargeError());
    const form = new FormData();
    form.set("email", "gerente@example.com");
    form.set("password", "test-password");
    await expect(loginAction(form)).rejects.toThrow(
      "REDIRECT:/login?error=session_too_large",
    );
    expect(saveActiveHotelCookieMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalledWith("/dashboard");
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redireciona para missing_fields quando formulario e invalido", async () => {
    const formData = new FormData();

    await expect(loginAction(formData)).rejects.toThrow(
      `REDIRECT:/login?error=${LOGIN_PAGE_ERROR_PARAM.MISSING_FIELDS}`,
    );

    expect(loginWithCredentialsMock).not.toHaveBeenCalled();
  });

  it("redireciona para invalid_credentials quando autenticacao falha", async () => {
    loginWithCredentialsMock.mockRejectedValueOnce(new Error("invalid"));

    const formData = new FormData();
    formData.set("email", "admin@example.com");
    formData.set("password", "wrong-pass");

    await expect(loginAction(formData)).rejects.toThrow(
      `REDIRECT:/login?error=${LOGIN_PAGE_ERROR_PARAM.INVALID_CREDENTIALS}`,
    );

    expect(loginWithCredentialsMock).toHaveBeenCalledWith(
      "admin@example.com",
      "wrong-pass",
    );
    expect(saveSessionCookieMock).not.toHaveBeenCalled();
    expect(saveActiveHotelCookieMock).not.toHaveBeenCalled();
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
        roleAssignments: [],
      },
    });
    getActiveHotelCookieValueMock.mockReturnValueOnce(undefined);
    resolveActiveHotelForUserMock.mockReturnValueOnce(null);

    const formData = new FormData();
    formData.set("email", "admin@example.com");
    formData.set("password", "Secret#123");

    await expect(loginAction(formData)).rejects.toThrow("REDIRECT:/dashboard");

    expect(saveSessionCookieMock).toHaveBeenCalledWith("token-123", 3600);
    expect(resolveActiveHotelForUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
      }),
      undefined,
    );
    expect(saveActiveHotelCookieMock).toHaveBeenCalledWith(null);
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});
