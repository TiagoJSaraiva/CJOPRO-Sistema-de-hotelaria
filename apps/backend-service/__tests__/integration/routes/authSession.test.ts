import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  type LoginSuccessResponse,
  type MeSuccessResponse,
} from "@hotel/shared";
import {
  createManagerAuthFixture,
  MANAGER_PASSWORD,
  managerPermissions,
} from "../../fixtures/managerAuth";
import { verifyToken } from "../../../src/auth/session";

describe("sessão compacta dos gerentes", () => {
  let fixture: Awaited<ReturnType<typeof createManagerAuthFixture>>;
  beforeAll(async () => {
    fixture = await createManagerAuthFixture();
  });
  afterAll(async () => {
    await fixture.app.close();
  });

  it.each([
    ["aurora", "hotel-e2e"],
    ["horizonte", "hotel-horizonte"],
  ])(
    "autentica %s com todas as permissões em cookie compacto",
    async (account, hotelId) => {
      const login = await fixture.app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: `${account}@session.test`,
          password: MANAGER_PASSWORD,
        },
      });
      expect(login.statusCode).toBe(200);
      const body = login.json<LoginSuccessResponse>();
      expect(body.expiresIn).toBe(28800);
      expect(body.token).toMatch(/^v2\./);
      expect(Buffer.byteLength(body.token)).toBeLessThan(3800);
      const session = verifyToken(body.token)!;
      expect(session.permissions).toEqual(managerPermissions);
      expect(session.permissions.length).toBeGreaterThanOrEqual(111);
      expect(
        Buffer.byteLength(
          Buffer.from(JSON.stringify(session)).toString("base64url"),
        ),
      ).toBeGreaterThan(4096);
      expect(session.permissions).not.toContain(PERMISSIONS.USER_CREATE);
      const me = await fixture.app.inject({
        method: "GET",
        url: "/auth/me",
        headers: {
          authorization: `Bearer ${body.token}`,
          "x-active-hotel-id": hotelId,
        },
      });
      expect(me.statusCode).toBe(200);
      expect(me.json<MeSuccessResponse>().user).toEqual(body.user);
      expect(me.json<MeSuccessResponse>().user.permissions).toContain(
        PERMISSIONS.MAINTENANCE_READ,
      );
      for (const forbidden of ["hotel-unassigned", "__global__"]) {
        const response = await fixture.app.inject({
          method: "GET",
          url: "/auth/me",
          headers: {
            authorization: `Bearer ${body.token}`,
            "x-active-hotel-id": forbidden,
          },
        });
        expect(response.statusCode).toBe(403);
      }
    },
  );

  it("recorta as permissões pelo hotel selecionado sem ampliar acesso", async () => {
    const login = await fixture.app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "multi@session.test",
        password: MANAGER_PASSWORD,
      },
    });
    const { token } = login.json<LoginSuccessResponse>();
    const me = await fixture.app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: `Bearer ${token}`,
        "x-active-hotel-id": "hotel-horizonte",
      },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json<MeSuccessResponse>().user.permissions).toEqual([
      PERMISSIONS.CUSTOMER_READ,
    ]);
  });
});
