import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../src/auth/session";
import { registerReservationsCalendarRoutes } from "../../src/routes/reservationsCalendarRoutes";
import type { ReservationsCalendarRepository } from "../../src/repositories/reservationsCalendarRepository";

const appsToClose: Array<ReturnType<typeof Fastify>> = [];

function createToken(permissions: string[]): string {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    id: "user-1",
    name: "Admin",
    email: "admin@example.com",
    tenantId: null,
    roles: ["Admin"],
    permissions,
    roleAssignments: [
      {
        roleId: "role-hotel",
        roleName: "Gestor",
        roleType: "HOTEL_ROLE",
        hotelId: "hotel-1",
        hotelName: "Hotel 1",
      },
    ],
    iat: nowInSeconds,
    exp: nowInSeconds + 3600,
  };
  return signToken(payload);
}

function createRepositoryMock(
  overrides: Partial<ReservationsCalendarRepository> = {},
): ReservationsCalendarRepository {
  return {
    getTimeline: vi.fn(async (_activeHotelId, startDate, endDate) => ({
      window_start: startDate,
      window_end: endDate,
      days: [],
      rooms: [],
      stays: [],
      blocks: [],
      legend: [],
    })),
    ...overrides,
  };
}

async function createTestApp(repository: ReservationsCalendarRepository) {
  const app = Fastify({ logger: false });
  registerReservationsCalendarRoutes(app, repository);
  await app.ready();
  appsToClose.push(app);
  return app;
}

afterEach(async () => {
  while (appsToClose.length) {
    await appsToClose.pop()!.close();
  }
});

describe("routes/reservations/calendar", () => {
  it("retorna 403 sem permissao", async () => {
    const repository = createRepositoryMock();
    const app = await createTestApp(repository);
    const response = await app.inject({
      method: "GET",
      url: "/admin/reservations/calendar?start_date=2026-05-06&days=20",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.RESERVATION_READ])}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("retorna 400 para start_date invalido", async () => {
    const repository = createRepositoryMock();
    const app = await createTestApp(repository);
    const response = await app.inject({
      method: "GET",
      url: "/admin/reservations/calendar?start_date=06-05-2026&days=20",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS])}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "ADMIN_VALIDATION_ERROR",
      message: "start_date invalido. Use o formato YYYY-MM-DD.",
    });
  });

  it("retorna timeline com intervalo calculado", async () => {
    const repository = createRepositoryMock();
    const app = await createTestApp(repository);
    const response = await app.inject({
      method: "GET",
      url: "/admin/reservations/calendar?start_date=2026-05-06&days=20",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS])}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getTimeline).toHaveBeenCalledWith(
      "hotel-1",
      "2026-05-06",
      "2026-05-25",
    );
  });
});
