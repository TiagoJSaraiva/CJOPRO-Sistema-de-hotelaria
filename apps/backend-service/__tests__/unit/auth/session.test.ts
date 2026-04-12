import { describe, expect, it } from "vitest";
import { PERMISSIONS, type SessionPayload } from "@hotel/shared";
import {
  getAuthError,
  getSessionFromRequest,
  hashTemporaryPassword,
  matchesPasswordHash,
  signToken,
  verifyToken
} from "../../../src/auth/session";

const basePayload: SessionPayload = {
  id: "user-1",
  name: "Admin",
  email: "admin@example.com",
  tenantId: null,
  roles: ["Admin"],
  permissions: [PERMISSIONS.USER_READ],
  roleAssignments: [],
  iat: 1_700_000_000,
  exp: 4_700_000_000
};

describe("auth/session", () => {
  it("assina e valida token com payload esperado", () => {
    const token = signToken(basePayload);

    const parsed = verifyToken(token);

    expect(parsed).toEqual(basePayload);
  });

  it("retorna null para token malformado", () => {
    expect(verifyToken("invalid-token")).toBeNull();
  });

  it("retorna null para token com assinatura adulterada", () => {
    const token = signToken(basePayload);
    const [payload] = token.split(".");

    expect(verifyToken(`${payload}.assinatura-invalida`)).toBeNull();
  });

  it("retorna null para token expirado", () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);

    const expiredToken = signToken({
      ...basePayload,
      iat: nowInSeconds - 20,
      exp: nowInSeconds - 10
    });

    expect(verifyToken(expiredToken)).toBeNull();
  });

  it("extrai sessao do header Authorization bearer", () => {
    const token = signToken(basePayload);

    const session = getSessionFromRequest({
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(session).toEqual(basePayload);
  });

  it("compara hash de senha temporaria com timing-safe", () => {
    const hash = hashTemporaryPassword("Secret#123");

    expect(matchesPasswordHash("Secret#123", hash)).toBe(true);
    expect(matchesPasswordHash("Wrong#123", hash)).toBe(false);
    expect(matchesPasswordHash("Secret#123", null)).toBe(false);
  });

  it("retorna erro de autenticacao com mensagem padrao", () => {
    const error = getAuthError("AUTH_FORBIDDEN");

    expect(error).toEqual({
      code: "AUTH_FORBIDDEN",
      message: "Sem permissao para executar esta operacao."
    });
  });
});
