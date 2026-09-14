import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
vi.mock("node:zlib", { spy: true });
import { PERMISSIONS, type SessionPayload } from "@hotel/shared";
import {
  getAuthError,
  getSessionFromRequest,
  hashTemporaryPassword,
  matchesPasswordHash,
  signToken,
  verifyToken,
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
  exp: 4_700_000_000,
};

function signed(body: string): string {
  return `${body}.${createHmac("sha256", process.env.AUTH_SESSION_SECRET!).update(body).digest("base64url")}`;
}

function compactJson(json: string): string {
  return signed(`v2.${deflateRawSync(json).toString("base64url")}`);
}

describe("auth/session", () => {
  it("aceita o formato legado de payload e assinatura", () => {
    const encoded = Buffer.from(JSON.stringify(basePayload)).toString(
      "base64url",
    );
    const signature = createHmac("sha256", process.env.AUTH_SESSION_SECRET!)
      .update(encoded)
      .digest("base64url");
    expect(verifyToken(`${encoded}.${signature}`)).toEqual(basePayload);
  });
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
    const parts = token.split(".");
    const signature = parts.pop()!;
    const forged = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    vi.mocked(inflateRawSync).mockClear();
    expect(verifyToken(`${parts.join(".")}.${forged}`)).toBeNull();
    expect(inflateRawSync).not.toHaveBeenCalled();
  });

  it("compacta todas as permissões sem perder vínculos ou dados", () => {
    const permissions = Object.values(PERMISSIONS);
    const payload: SessionPayload = {
      ...basePayload,
      permissions,
      roleAssignments: ["hotel-a", "hotel-b"].map((hotelId) => ({
        roleId: `role-${hotelId}`,
        roleName: "Gerência",
        roleType: "HOTEL_ROLE",
        hotelId,
        hotelName: `Hotel ${hotelId}`,
        permissions,
      })),
    };
    const token = signToken(payload);
    expect(token.startsWith("v2.")).toBe(true);
    expect(Buffer.byteLength(token)).toBeLessThan(3800);
    expect(verifyToken(token)).toEqual(payload);
  });

  it("rejeita versões desconhecidas, segmentos extras e base64 inválido", () => {
    const token = signToken(basePayload);
    expect(verifyToken(token.replace("v2.", "v3."))).toBeNull();
    expect(verifyToken(`${token}.extra`)).toBeNull();
    expect(verifyToken(signed("v2.%%%"))).toBeNull();
    expect(verifyToken("v2..signature")).toBeNull();
  });

  it("rejeita compressão e conteúdo inválidos mesmo com assinatura válida", () => {
    expect(
      verifyToken(
        signed(`v2.${Buffer.from("not-deflate").toString("base64url")}`),
      ),
    ).toBeNull();
    for (const json of [
      "not-json",
      "null",
      "[]",
      JSON.stringify({ exp: 4700000000 }),
      JSON.stringify({ ...basePayload, exp: "4700000000" }),
      JSON.stringify({ ...basePayload, permissions: [42] }),
    ]) {
      expect(verifyToken(compactJson(json))).toBeNull();
    }
  });

  it("limita a descompactação a 64 KiB e não emite payload que exceda esse limite", () => {
    const empty = { ...basePayload, name: "" };
    const name = "x".repeat(65536 - Buffer.byteLength(JSON.stringify(empty)));
    const boundary = { ...empty, name };
    expect(verifyToken(compactJson(JSON.stringify(boundary)))).toEqual(
      boundary,
    );
    const oversized = { ...boundary, name: `${name}x` };
    expect(verifyToken(compactJson(JSON.stringify(oversized)))).toBeNull();
    expect(() => signToken(oversized)).toThrow("supported size");
  });

  it("rejeita token legado expirado ou adulterado", () => {
    const encoded = Buffer.from(
      JSON.stringify({ ...basePayload, exp: 1 }),
    ).toString("base64url");
    expect(verifyToken(signed(encoded))).toBeNull();
    expect(verifyToken(`${encoded}.invalid`)).toBeNull();
  });

  it("retorna null para token expirado", () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);

    const expiredToken = signToken({
      ...basePayload,
      iat: nowInSeconds - 20,
      exp: nowInSeconds - 10,
    });

    expect(verifyToken(expiredToken)).toBeNull();
  });

  it("extrai sessao do header Authorization bearer", () => {
    const token = signToken(basePayload);

    const session = getSessionFromRequest({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(session).toEqual(basePayload);
  });

  it("compara hash de senha temporaria com argon2id", async () => {
    const hash = await hashTemporaryPassword("Secret#123");

    await expect(matchesPasswordHash("Secret#123", hash)).resolves.toBe(true);
    await expect(matchesPasswordHash("Wrong#123", hash)).resolves.toBe(false);
    await expect(matchesPasswordHash("Secret#123", null)).resolves.toBe(false);
  });

  it("retorna erro de autenticacao com mensagem padrao", () => {
    const error = getAuthError("AUTH_FORBIDDEN");

    expect(error).toEqual({
      code: "AUTH_FORBIDDEN",
      message: "Sem permissão para executar esta operação.",
    });
  });
});
