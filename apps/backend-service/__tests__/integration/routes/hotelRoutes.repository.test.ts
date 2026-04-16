import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type SessionPayload } from "@hotel/shared";
import { signToken } from "../../../src/auth/session";
import { registerHotelRoutes } from "../../../src/routes/hotelRoutes";
import type { HotelsRepository } from "../../../src/repositories/hotelsRepository";

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
    roleAssignments: [],
    iat: nowInSeconds,
    exp: nowInSeconds + 3600
  };

  return signToken(payload);
}

async function createHotelsTestApp(repository: HotelsRepository) {
  const app = Fastify({ logger: false });
  registerHotelRoutes(app, repository);
  await app.ready();
  appsToClose.push(app);
  return app;
}

afterEach(async () => {
  while (appsToClose.length) {
    await appsToClose.pop()!.close();
  }
});

describe("routes/hotels with injected repository", () => {
  it("lista hoteis com repository injetado", async () => {
    const repository: HotelsRepository = {
      listHotels: vi.fn(async (activeHotelId?: string | null) => [
        {
          id: "hotel-1",
          name: "Hotel Centro"
        }
      ]),
      createHotel: vi.fn(async () => ({ result: "ok", item: { id: "hotel-1", name: "Hotel Centro" } })),
      updateHotel: vi.fn(async () => ({ result: "ok", item: { id: "hotel-1", name: "Hotel Centro" } })),
      deleteHotel: vi.fn(async () => "ok")
    };

    const app = await createHotelsTestApp(repository);

    const response = await app.inject({
      method: "GET",
      url: "/admin/hotels",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.HOTEL_READ])}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          id: "hotel-1",
          name: "Hotel Centro"
        }
      ]
    });
    expect(repository.listHotels).toHaveBeenCalledTimes(1);
  });

  it("retorna 409 quando repository sinaliza conflito de slug no cadastro", async () => {
    const repository: HotelsRepository = {
      listHotels: vi.fn(async () => []),
      createHotel: vi.fn(async () => ({ result: "conflict" })),
      updateHotel: vi.fn(async () => ({ result: "ok", item: { id: "hotel-1" } })),
      deleteHotel: vi.fn(async () => "ok")
    };

    const app = await createHotelsTestApp(repository);

    const response = await app.inject({
      method: "POST",
      url: "/admin/hotels",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.HOTEL_CREATE])}`
      },
      payload: {
        name: "Hotel Centro",
        legal_name: "Hotel Centro LTDA",
        tax_id: "123456789",
        slug: "hotel-centro",
        email: "contato@hotel.com",
        phone: "11999999999",
        address_line: "Rua Central",
        address_number: "100",
        address_complement: "Sala 1",
        district: "Centro",
        city: "Sao Paulo",
        state: "SP",
        country: "US",
        zip_code: "10001",
        timezone: "America/New_York",
        currency: "USD"
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ message: "Slug ja utilizado por outro hotel." });
    expect(repository.createHotel).toHaveBeenCalledTimes(1);
  });

  it("retorna 409 quando delete de hotel sinaliza conflito", async () => {
    const repository: HotelsRepository = {
      listHotels: vi.fn(async () => []),
      createHotel: vi.fn(async () => ({ result: "ok", item: { id: "hotel-1" } })),
      updateHotel: vi.fn(async () => ({ result: "ok", item: { id: "hotel-1" } })),
      deleteHotel: vi.fn(async () => "conflict")
    };

    const app = await createHotelsTestApp(repository);

    const response = await app.inject({
      method: "DELETE",
      url: "/admin/hotels/hotel-1",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.HOTEL_DELETE])}`
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ message: "Hotel nao pode ser excluido: possui dependencias ativas." });
  });
});