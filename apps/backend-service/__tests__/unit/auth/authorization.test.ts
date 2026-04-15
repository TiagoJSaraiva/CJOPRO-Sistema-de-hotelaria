import { describe, expect, it, vi } from "vitest";
import { ACTIVE_HOTEL_HEADER_NAME, AUTH_ERROR_CODE, PERMISSIONS, type SessionPayload } from "@hotel/shared";
import { ensureAuthorized, ensureAuthorizedAny, hasPermission } from "../../../src/auth/authorization";
import { signToken } from "../../../src/auth/session";

const baseSession: SessionPayload = {
  id: "user-1",
  name: "Admin",
  email: "admin@example.com",
  tenantId: null,
  roles: ["Admin"],
  permissions: [PERMISSIONS.HOTEL_READ, PERMISSIONS.USER_READ],
  roleAssignments: [],
  iat: 1_700_000_000,
  exp: 4_700_000_000
};

function createReplyMock() {
  const send = vi.fn();
  const status = vi.fn(() => ({ send }));

  return {
    reply: { status },
    status,
    send
  };
}

describe("auth/authorization", () => {
  it("hasPermission retorna true quando usuario possui permissao", () => {
    expect(hasPermission(baseSession, PERMISSIONS.HOTEL_READ)).toBe(true);
  });

  it("hasPermission retorna false quando usuario nao possui permissao", () => {
    expect(hasPermission(baseSession, PERMISSIONS.HOTEL_DELETE)).toBe(false);
  });

  it("ensureAuthorized retorna 401 quando token nao e informado", () => {
    const { reply, status, send } = createReplyMock();

    const result = ensureAuthorized({ headers: {} }, reply, PERMISSIONS.HOTEL_READ);

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: AUTH_ERROR_CODE.TOKEN_INVALID_OR_EXPIRED
      })
    );
  });

  it("ensureAuthorized retorna 403 quando usuario nao tem permissao", () => {
    const { reply, status, send } = createReplyMock();
    const token = signToken(baseSession);

    const result = ensureAuthorized(
      { headers: { authorization: `Bearer ${token}` } },
      reply,
      PERMISSIONS.HOTEL_DELETE
    );

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: AUTH_ERROR_CODE.FORBIDDEN
      })
    );
  });

  it("ensureAuthorized retorna sessao quando usuario possui permissao", () => {
    const { reply } = createReplyMock();
    const token = signToken(baseSession);

    const result = ensureAuthorized(
      { headers: { authorization: `Bearer ${token}` } },
      reply,
      PERMISSIONS.HOTEL_READ
    );

    expect(result).toEqual(baseSession);
  });

  it("ensureAuthorizedAny retorna sessao quando possui ao menos uma permissao", () => {
    const { reply } = createReplyMock();
    const token = signToken(baseSession);

    const result = ensureAuthorizedAny(
      { headers: { authorization: `Bearer ${token}` } },
      reply,
      [PERMISSIONS.HOTEL_DELETE, PERMISSIONS.USER_READ]
    );

    expect(result).toEqual(baseSession);
  });

  it("ensureAuthorizedAny retorna 403 quando nao possui nenhuma permissao", () => {
    const { reply, status, send } = createReplyMock();
    const token = signToken(baseSession);

    const result = ensureAuthorizedAny(
      { headers: { authorization: `Bearer ${token}` } },
      reply,
      [PERMISSIONS.HOTEL_DELETE, PERMISSIONS.USER_DELETE]
    );

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: AUTH_ERROR_CODE.FORBIDDEN
      })
    );
  });

  it("ensureAuthorized retorna 403 quando hotel ativo informado nao pertence ao usuario", () => {
    const { reply, status, send } = createReplyMock();
    const token = signToken({
      ...baseSession,
      roleAssignments: [
        {
          roleId: "role-1",
          roleName: "Recepcao",
          roleType: "HOTEL_ROLE",
          hotelId: "hotel-1",
          hotelName: "Alpha"
        }
      ]
    });

    const result = ensureAuthorized(
      {
        headers: {
          authorization: `Bearer ${token}`,
          [ACTIVE_HOTEL_HEADER_NAME]: "hotel-999"
        }
      },
      reply,
      PERMISSIONS.HOTEL_READ
    );

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Hotel ativo nao permitido para este usuario."
      })
    );
  });
});