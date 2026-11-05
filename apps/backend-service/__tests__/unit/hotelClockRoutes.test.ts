import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_HOTEL_HEADER_NAME, type SessionPayload } from "@hotel/shared";
import { signToken } from "../../src/auth/session";
import { registerHotelClockRoutes } from "../../src/routes/hotelClockRoutes";
import type { HotelClockRepository } from "../../src/repositories/hotelClockRepository";

const appsToClose: Array<ReturnType<typeof Fastify>> = [];
const HOTEL_A = "10000000-0000-4000-8000-00000000000a";
const HOTEL_B = "10000000-0000-4000-8000-00000000000b";
const CLOCK = {
  timezone: "America/Sao_Paulo",
  operational_date: "2026-11-04",
  operational_now: "2026-11-04T17:00:00.000Z",
};

function assignment(
  hotelId: string | null,
): SessionPayload["roleAssignments"][number] {
  return {
    roleId: "role-1",
    roleName: "Recepção",
    roleType: hotelId ? "HOTEL_ROLE" : "SYSTEM_ROLE",
    hotelId,
    hotelName: hotelId ? "Hotel" : null,
  };
}

// Sem nenhuma permissão: a rota só depende de sessão e escopo.
function token(roleAssignments: SessionPayload["roleAssignments"]) {
  const now = Math.floor(Date.now() / 1000);
  return signToken({
    id: "user-1",
    name: "Pessoa",
    email: "pessoa@example.com",
    tenantId: null,
    roles: [],
    permissions: [],
    roleAssignments,
    iat: now,
    exp: now + 3600,
  });
}

async function createTestApp(getClock: HotelClockRepository["getClock"]) {
  const app = Fastify({ logger: false });
  registerHotelClockRoutes(app, { getClock });
  await app.ready();
  appsToClose.push(app);
  return app;
}

afterEach(async () => {
  while (appsToClose.length) await appsToClose.pop()?.close();
});

describe("GET /admin/hotel-clock", () => {
  it("devolve o relógio do hotel ativo a quem não tem permissão de domínio", async () => {
    const getClock = vi.fn(async () => CLOCK);
    const app = await createTestApp(getClock);

    const response = await app.inject({
      method: "GET",
      url: "/admin/hotel-clock",
      headers: {
        authorization: `Bearer ${token([assignment(HOTEL_A)])}`,
        [ACTIVE_HOTEL_HEADER_NAME]: HOTEL_A,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(CLOCK);
    expect(getClock).toHaveBeenCalledWith(HOTEL_A);
  });

  it("recusa quem não tem sessão", async () => {
    const getClock = vi.fn(async () => CLOCK);
    const app = await createTestApp(getClock);

    const response = await app.inject({
      method: "GET",
      url: "/admin/hotel-clock",
    });

    expect(response.statusCode).toBe(401);
    expect(getClock).not.toHaveBeenCalled();
  });

  it("não revela o relógio de um hotel fora do escopo da sessão", async () => {
    const getClock = vi.fn(async () => CLOCK);
    const app = await createTestApp(getClock);

    const response = await app.inject({
      method: "GET",
      url: "/admin/hotel-clock",
      headers: {
        authorization: `Bearer ${token([assignment(HOTEL_A)])}`,
        [ACTIVE_HOTEL_HEADER_NAME]: HOTEL_B,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(getClock).not.toHaveBeenCalled();
  });

  it("ignora um hotel informado fora do escopo validado", async () => {
    const getClock = vi.fn(async () => CLOCK);
    const app = await createTestApp(getClock);

    await app.inject({
      method: "GET",
      url: `/admin/hotel-clock?hotel_id=${HOTEL_B}`,
      headers: {
        authorization: `Bearer ${token([assignment(HOTEL_A)])}`,
        [ACTIVE_HOTEL_HEADER_NAME]: HOTEL_A,
      },
    });

    expect(getClock).toHaveBeenCalledWith(HOTEL_A);
  });

  it("exige um hotel ativo no escopo global", async () => {
    const getClock = vi.fn(async () => CLOCK);
    const app = await createTestApp(getClock);

    const response = await app.inject({
      method: "GET",
      url: "/admin/hotel-clock",
      headers: { authorization: `Bearer ${token([assignment(null)])}` },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.statusCode).toBeLessThan(500);
    expect(getClock).not.toHaveBeenCalled();
  });

  it("responde 404 quando o hotel não existe", async () => {
    const app = await createTestApp(vi.fn(async () => null));

    const response = await app.inject({
      method: "GET",
      url: "/admin/hotel-clock",
      headers: {
        authorization: `Bearer ${token([assignment(HOTEL_A)])}`,
        [ACTIVE_HOTEL_HEADER_NAME]: HOTEL_A,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it("responde 500 sem expor o erro do banco", async () => {
    const app = await createTestApp(
      vi.fn(async () => {
        throw new Error("detalhe interno do banco");
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/admin/hotel-clock",
      headers: {
        authorization: `Bearer ${token([assignment(HOTEL_A)])}`,
        [ACTIVE_HOTEL_HEADER_NAME]: HOTEL_A,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("detalhe interno");
  });
});
