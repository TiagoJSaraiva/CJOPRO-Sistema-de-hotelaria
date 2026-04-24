import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_HOTEL_HEADER_NAME, PERMISSIONS, type SessionPayload } from "@hotel/shared";
import { signToken } from "../../../src/auth/session";
import { registerRoomRoutes } from "../../../src/routes/roomRoutes";
import type { RoomsRepository } from "../../../src/repositories/roomsRepository";

const appsToClose: Array<ReturnType<typeof Fastify>> = [];

function createToken(permissions: string[], roleAssignments: SessionPayload["roleAssignments"]): string {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  return signToken({
    id: "user-1",
    name: "Admin",
    email: "admin@example.com",
    tenantId: null,
    roles: ["Admin"],
    permissions,
    roleAssignments,
    iat: nowInSeconds,
    exp: nowInSeconds + 3600
  });
}

function createRoomsRepositoryMock(overrides: Partial<RoomsRepository> = {}): RoomsRepository {
  return {
    listRooms: vi.fn(async () => []),
    createRoom: vi.fn(async () => ({ result: "ok", item: undefined })),
    updateRoom: vi.fn(async () => ({ result: "ok", item: undefined })),
    deleteRoom: vi.fn(async () => "ok"),
    ...overrides
  };
}

async function createTestApp(repository: RoomsRepository) {
  const app = Fastify({ logger: false });
  registerRoomRoutes(app, repository);
  await app.ready();
  appsToClose.push(app);
  return app;
}

afterEach(async () => {
  while (appsToClose.length) {
    await appsToClose.pop()!.close();
  }
});

describe("routes/rooms with injected repository", () => {
  it("exige hotel ativo para listar quartos", async () => {
    const repository = createRoomsRepositoryMock();
    const app = await createTestApp(repository);

    const token = createToken([PERMISSIONS.ROOM_READ], [
      { roleId: "role-system", roleName: "System", roleType: "SYSTEM_ROLE", hotelId: null, hotelName: null }
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/admin/rooms",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "ADMIN_SCOPE_NOT_ALLOWED",
      message: "Selecione um hotel ativo para operar neste modulo."
    });
    expect(repository.listRooms).not.toHaveBeenCalled();
  });

  it("aplica escopo de hotel ao listar quartos", async () => {
    const repository = createRoomsRepositoryMock({
      listRooms: vi.fn(async () => [
        {
          id: "room-1",
          hotel_id: "hotel-1",
          room_number: "101",
          room_type: "standard",
          max_occupancy: 2,
          base_daily_rate: 200,
          status: "available",
          notes: null
        }
      ])
    });

    const app = await createTestApp(repository);

    const token = createToken([PERMISSIONS.ROOM_READ], [
      { roleId: "role-hotel", roleName: "Manager", roleType: "HOTEL_ROLE", hotelId: "hotel-1", hotelName: "Hotel 1" }
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/admin/rooms",
      headers: {
        authorization: `Bearer ${token}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(repository.listRooms).toHaveBeenCalledWith("hotel-1");
    expect(response.json()).toEqual({
      items: [
        {
          id: "room-1",
          hotel_id: "hotel-1",
          room_number: "101",
          room_type: "standard",
          max_occupancy: 2,
          base_daily_rate: 200,
          status: "available",
          notes: null
        }
      ]
    });
  });
});
