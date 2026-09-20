import Fastify from "fastify";
import { afterEach, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type SessionPayload,
} from "@hotel/shared";
import {
  API_COMPONENT_SCHEMAS,
  API_ROUTE_CONTRACTS,
} from "@hotel/shared/api-contract";
import { signToken } from "../../src/auth/session";
import { registerBookingOperationsRoutes } from "../../src/routes/bookingOperationsRoutes";
import type { BookingOperationsRepository } from "../../src/repositories/bookingOperationsRepository";

const hotel = "10000000-0000-4000-8000-000000000001",
  user = "80000000-0000-4000-8000-000000000002",
  id = "90000000-0000-4000-8000-000000000001";
const apps: ReturnType<typeof Fastify>[] = [];
function headers(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const session: SessionPayload = {
    id: user,
    name: "Reservas",
    email: "reservas@hotel.local",
    tenantId: null,
    roles: ["Reservas"],
    permissions,
    roleAssignments: [
      {
        roleId: "role",
        roleName: "Reservas",
        roleType: "HOTEL_ROLE",
        hotelId: hotel,
        hotelName: "Hotel",
      },
    ],
    iat: now,
    exp: now + 3600,
  };
  return {
    authorization: `Bearer ${signToken(session)}`,
    [ACTIVE_HOTEL_HEADER_NAME]: hotel,
  };
}
async function setup() {
  const repository: BookingOperationsRepository = {
    query: vi.fn().mockResolvedValue({ items: [] }),
    mutate: vi.fn().mockResolvedValue({ result: "ok", id }),
  };
  const app = Fastify();
  for (const schema of API_COMPONENT_SCHEMAS) app.addSchema(schema);
  app.addHook("onRoute", (options) => {
    const contract = API_ROUTE_CONTRACTS[`${options.method} ${options.url}`];
    if (contract) options.schema = contract;
  });
  registerBookingOperationsRoutes(app, repository);
  await app.ready();
  apps.push(app);
  return { app, repository };
}
afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

it("protege leitura por autenticação, permissão e hotel", async () => {
  const { app, repository } = await setup();
  expect((await app.inject({ url: "/admin/rate-plans" })).statusCode).toBe(401);
  expect(
    (await app.inject({ url: "/admin/rate-plans", headers: headers([]) }))
      .statusCode,
  ).toBe(403);
  expect(repository.query).not.toHaveBeenCalled();
});
it("lista planos sem mutação", async () => {
  const { app, repository } = await setup();
  expect(
    (
      await app.inject({
        url: "/admin/rate-plans",
        headers: headers([PERMISSIONS.RESERVATION_READ]),
      })
    ).statusCode,
  ).toBe(200);
  expect(repository.query).toHaveBeenCalledWith("list_rate_plans", {
    p_hotel_id: hotel,
  });
  expect(repository.mutate).not.toHaveBeenCalled();
});
it("retorna referências de canal no hotel ativo", async () => {
  const { app, repository } = await setup();
  vi.mocked(repository.query).mockResolvedValueOnce({
    room_types: [],
    rate_plans: [],
  });
  const response = await app.inject({
    url: "/admin/booking-channels/reference-data",
    headers: headers([PERMISSIONS.BOOKING_CHANNELS_MANAGE]),
  });
  expect(response.statusCode).toBe(200);
  expect(repository.query).toHaveBeenCalledWith(
    "list_booking_channel_reference_data",
    { p_hotel_id: hotel },
  );
});
it("valida e encaminha alteração versionada", async () => {
  const { app, repository } = await setup();
  const post = (payload: unknown) =>
    app.inject({
      method: "POST",
      url: `/admin/reservations/${id}/amendments`,
      headers: headers([PERMISSIONS.RESERVATION_AMENDMENTS_MANAGE]),
      payload,
    });
  expect((await post({})).statusCode).toBe(400);
  const response = await post({
    accommodation_id: id,
    checkin_date: "2026-10-10",
    checkout_date: "2026-10-12",
    room_type: "standard",
    adults: 2,
    children: 0,
    expected_version: 1,
    idempotency_key: "91000000-0000-4000-8000-000000000001",
    reason: "Extensão solicitada",
  });
  expect(response.statusCode).toBe(200);
  expect(repository.mutate).toHaveBeenCalledWith(
    "apply_reservation_amendment",
    expect.objectContaining({
      p_hotel_id: hotel,
      p_actor_id: user,
      p_can_override: false,
    }),
  );
});
it("traduz concorrência em 409", async () => {
  const { app, repository } = await setup();
  vi.mocked(repository.mutate).mockResolvedValueOnce({
    result: "conflict",
    context: { version: 2 },
  });
  const response = await app.inject({
    method: "POST",
    url: `/admin/reservations/${id}/room-assignments`,
    headers: headers([PERMISSIONS.ROOM_ASSIGNMENTS_MANAGE]),
    payload: {
      accommodation_id: id,
      room_id: "20000000-0000-4000-8000-000000000101",
      expected_version: 1,
      idempotency_key: "91000000-0000-4000-8000-000000000001",
      reason: "Alocação para chegada",
    },
  });
  expect(response.statusCode).toBe(409);
  expect(response.json().context).toEqual({ version: 2 });
});

it("encaminha configuração, canais e indicadores com permissões próprias", async () => {
  const { app, repository } = await setup();
  const bookingHeaders = headers([
    PERMISSIONS.BOOKING_CONFIGURATION_MANAGE,
    PERMISSIONS.BOOKING_CHANNELS_MANAGE,
    PERMISSIONS.INTEGRATED_ANALYTICS_READ,
  ]);
  expect(
    (
      await app.inject({
        url: "/admin/booking-configuration",
        headers: bookingHeaders,
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/admin/booking-channels",
        headers: bookingHeaders,
        payload: { name: "Hub neutro", code: "HUB" },
      })
    ).statusCode,
  ).toBe(201);
  expect(
    (
      await app.inject({
        url: "/admin/booking-channels/inbox",
        headers: bookingHeaders,
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/admin/booking-channels/import",
        headers: bookingHeaders,
        payload: {
          channel_id: id,
          rows: [
            {
              event_id: "event-1",
              event_type: "create",
              external_reservation_id: "external-1",
              occurred_at: "2026-09-12T12:00:00Z",
              reservation: {
                room_code: "STD",
                rate_code: "FLEX",
                checkin_date: "2026-10-10",
                checkout_date: "2026-10-12",
                adults: 2,
                children: 0,
                currency: "BRL",
                total: 500,
                guest_name: "Maria",
              },
            },
          ],
        },
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/admin/analytics/operations/reconcile",
        headers: bookingHeaders,
        payload: { from: "2026-09-01", to: "2026-09-12" },
      })
    ).statusCode,
  ).toBe(200);
  expect(repository.query).toHaveBeenCalledWith("get_booking_configuration", {
    p_hotel_id: hotel,
  });
  expect(repository.mutate).toHaveBeenCalledWith(
    "import_booking_channel_events",
    expect.objectContaining({ p_hotel_id: hotel, p_channel_id: id }),
  );
  expect(repository.mutate).toHaveBeenCalledWith(
    "reconcile_integrated_analytics",
    expect.objectContaining({
      p_hotel_id: hotel,
      p_from: "2026-09-01",
      p_to: "2026-09-12",
    }),
  );
});
