import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../src/auth/session";
import { registerSeasonRoomRateRoutes } from "../../src/routes/seasonRoomRateRoutes";
import type { SeasonRoomRatesRepository } from "../../src/repositories/seasonRoomRatesRepository";
import type { SeasonsRepository } from "../../src/repositories/seasonsRepository";

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

function createSeasonRoomRatesRepositoryMock(
  overrides: Partial<SeasonRoomRatesRepository> = {},
): SeasonRoomRatesRepository {
  return {
    listSeasonRoomRates: vi.fn(async () => []),
    createSeasonRoomRate: vi.fn(async () => ({
      result: "ok",
      item: undefined,
    })),
    updateSeasonRoomRate: vi.fn(async () => ({
      result: "ok",
      item: undefined,
    })),
    deleteSeasonRoomRate: vi.fn(async () => "ok"),
    ...overrides,
  };
}

function createSeasonsRepositoryMock(
  overrides: Partial<SeasonsRepository> = {},
): SeasonsRepository {
  return {
    listSeasons: vi.fn(async () => []),
    findSeasonById: vi.fn(async () => null),
    createSeason: vi.fn(async () => ({ result: "ok", item: undefined })),
    updateSeason: vi.fn(async () => ({ result: "ok", item: undefined })),
    deleteSeason: vi.fn(async () => "ok"),
    ...overrides,
  };
}

async function createTestApp(
  roomRatesRepository: SeasonRoomRatesRepository,
  seasonsRepository: SeasonsRepository,
) {
  const app = Fastify({ logger: false });
  registerSeasonRoomRateRoutes(app, roomRatesRepository, seasonsRepository);
  await app.ready();
  appsToClose.push(app);
  return app;
}

afterEach(async () => {
  while (appsToClose.length) {
    await appsToClose.pop()!.close();
  }
});

describe("routes/season-room-rates with injected repositories", () => {
  it("retorna 404 quando a temporada selecionada nao pertence ao hotel ativo", async () => {
    const roomRatesRepository = createSeasonRoomRatesRepositoryMock();
    const seasonsRepository = createSeasonsRepositoryMock({
      findSeasonById: vi.fn(async () => null),
    });
    const app = await createTestApp(roomRatesRepository, seasonsRepository);

    const response = await app.inject({
      method: "POST",
      url: "/admin/season-room-rates",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.SEASON_ROOM_RATE_CREATE])}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
      payload: {
        season_id: "season-999",
        room_type: "suite",
        daily_rate: 250,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      code: "ADMIN_NOT_FOUND",
      message: "Temporada nao encontrada neste hotel.",
    });
    expect(seasonsRepository.findSeasonById).toHaveBeenCalledWith(
      "hotel-1",
      "season-999",
    );
    expect(roomRatesRepository.createSeasonRoomRate).not.toHaveBeenCalled();
  });

  it("cria tarifa usando o season_id selecionado quando a temporada existe no hotel", async () => {
    const roomRatesRepository = createSeasonRoomRatesRepositoryMock({
      createSeasonRoomRate: vi.fn(async () => ({
        result: "ok",
        item: {
          id: "rate-1",
          hotel_id: "hotel-1",
          season_id: "season-1",
          room_type: "suite",
          daily_rate: 250,
          created_at: "2026-04-30T00:00:00.000Z",
          updated_at: "2026-04-30T00:00:00.000Z",
        },
      })),
    });
    const seasonsRepository = createSeasonsRepositoryMock({
      findSeasonById: vi.fn(async () => ({
        id: "season-1",
        hotel_id: "hotel-1",
        name: "Alta temporada",
        start_date: "2026-12-01",
        end_date: "2027-02-28",
        is_active: true,
      })),
    });
    const app = await createTestApp(roomRatesRepository, seasonsRepository);

    const response = await app.inject({
      method: "POST",
      url: "/admin/season-room-rates",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.SEASON_ROOM_RATE_CREATE])}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
      payload: {
        season_id: "season-1",
        room_type: "suite",
        daily_rate: 250,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(seasonsRepository.findSeasonById).toHaveBeenCalledWith(
      "hotel-1",
      "season-1",
    );
    expect(roomRatesRepository.createSeasonRoomRate).toHaveBeenCalledWith(
      "hotel-1",
      {
        season_id: "season-1",
        room_type: "suite",
        daily_rate: 250,
      },
    );
    expect(response.json()).toEqual({
      item: {
        id: "rate-1",
        hotel_id: "hotel-1",
        season_id: "season-1",
        room_type: "suite",
        daily_rate: 250,
        created_at: "2026-04-30T00:00:00.000Z",
        updated_at: "2026-04-30T00:00:00.000Z",
      },
    });
  });
});
