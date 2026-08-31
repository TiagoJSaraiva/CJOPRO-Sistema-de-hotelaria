import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/common/supabaseServer", () => ({
  createServerClient: vi.fn(),
}));

import {
  ACTIVE_HOTEL_HEADER_NAME,
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../src/auth/session";
import { createServerClient } from "../../src/common/supabaseServer";
import { registerStayOperationsRoutes } from "../../src/routes/stayOperationsRoutes";

const appsToClose: Array<ReturnType<typeof Fastify>> = [];

type SupabaseMockOptions = {
  rooms?: Array<{ id: string; hotel_id: string; room_number: string }>;
  candidateStays?: Array<{ id: string; room_id: string; stay_status: string }>;
  panelStay?: Record<string, unknown> | null;
  reservationStays?: Array<{
    total_price_estimated: number | null;
    total_paid: number | null;
  }>;
  payments?: Array<Record<string, unknown>>;
};

function createToken(
  permissions: string[] = [PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS],
): string {
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

function createPanelStay(overrides: Record<string, unknown> = {}) {
  return {
    id: "stay-2",
    reservation_id: "reservation-2",
    room_id: "room-102",
    stay_status: "checked_in",
    checkin_date_expected: "2026-05-15T00:00:00.000Z",
    checkout_date_expected: "2026-05-18T00:00:00.000Z",
    checkin_date_actual: "2026-05-15T17:30:00.000Z",
    checkout_date_actual: null,
    total_price_estimated: 960,
    total_paid: 960,
    reservations: {
      id: "reservation-2",
      hotel_id: "hotel-1",
      reservation_code: "RES-1002",
      customers: {
        full_name: "Bruno Lima",
      },
    },
    rooms: {
      id: "room-102",
      hotel_id: "hotel-1",
      room_number: "102",
      room_type: "Standard",
      hotels: {
        id: "hotel-1",
        timezone: "America/Sao_Paulo",
        checkin_time_start: "14:00",
        checkin_time_limit: "22:00",
        checkout_time_start: "08:00",
        checkout_time_limit: "12:00",
      },
    },
    ...overrides,
  };
}

function createSupabaseMock(options: SupabaseMockOptions = {}) {
  function resolve(
    table: string,
    selected: string,
    filters: Record<string, unknown>,
  ) {
    if (table === "rooms") {
      return {
        data: (options.rooms || []).filter(
          (room) =>
            room.hotel_id === filters.hotel_id &&
            room.room_number === filters.room_number,
        ),
        error: null,
      };
    }

    if (table === "stays" && selected === "id") {
      return {
        data: (options.candidateStays || []).filter(
          (stay) =>
            stay.room_id === filters.room_id &&
            stay.stay_status === filters.stay_status,
        ),
        error: null,
      };
    }

    if (table === "stays" && selected.startsWith("id,reservation_id")) {
      const panelStay =
        options.panelStay === undefined ? createPanelStay() : options.panelStay;
      return {
        data: panelStay && panelStay.id === filters.id ? [panelStay] : [],
        error: null,
      };
    }

    if (table === "stays" && selected === "total_price_estimated,total_paid") {
      return {
        data: options.reservationStays || [
          { total_price_estimated: 960, total_paid: 960 },
        ],
        error: null,
      };
    }

    if (table === "financial_transactions") {
      return {
        data: options.payments || [],
        error: null,
      };
    }

    return { data: [], error: null };
  }

  const from = vi.fn((table: string) => {
    let selected = "";
    const filters: Record<string, unknown> = {};
    const builder: any = {};

    builder.select = vi.fn((fields: string) => {
      selected = fields;
      return builder;
    });
    builder.eq = vi.fn((column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    });
    builder.in = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.single = vi.fn(async () => {
      const result = resolve(table, selected, filters);
      const row = result.data[0] || null;
      return { data: row, error: row ? null : { code: "PGRST116" } };
    });
    builder.then = (
      onFulfilled: (value: { data: unknown[]; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve(resolve(table, selected, filters)).then(
        onFulfilled,
        onRejected,
      );
    builder.catch = (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(resolve(table, selected, filters)).catch(onRejected);

    return builder;
  });

  return { from };
}

async function createTestApp() {
  const app = Fastify({ logger: false });
  registerStayOperationsRoutes(app);
  await app.ready();
  appsToClose.push(app);
  return app;
}

afterEach(async () => {
  vi.useRealTimers();
  while (appsToClose.length) {
    await appsToClose.pop()!.close();
  }
});

describe("routes/stays checkout candidate", () => {
  it("retorna 403 sem permissao de calendario", async () => {
    const app = await createTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/admin/stays/checkout-candidate?room_number=102",
      headers: {
        authorization: `Bearer ${createToken([PERMISSIONS.RESERVATION_READ])}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("retorna 400 quando room_number nao e informado", async () => {
    const app = await createTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/admin/stays/checkout-candidate",
      headers: {
        authorization: `Bearer ${createToken()}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: ADMIN_ERROR_CODE.VALIDATION,
      message: "Numero do quarto obrigatorio.",
    });
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("retorna 404 quando quarto nao existe no hotel ativo", async () => {
    vi.mocked(createServerClient).mockReturnValue(
      createSupabaseMock({ rooms: [] }) as any,
    );
    const app = await createTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/admin/stays/checkout-candidate?room_number=102",
      headers: {
        authorization: `Bearer ${createToken()}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      code: ADMIN_ERROR_CODE.NOT_FOUND,
      message: "Quarto nao encontrado para o hotel ativo.",
    });
  });

  it("retorna 404 quando quarto nao possui estadia em check-in", async () => {
    vi.mocked(createServerClient).mockReturnValue(
      createSupabaseMock({
        rooms: [{ id: "room-102", hotel_id: "hotel-1", room_number: "102" }],
      }) as any,
    );
    const app = await createTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/admin/stays/checkout-candidate?room_number=102",
      headers: {
        authorization: `Bearer ${createToken()}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      code: ADMIN_ERROR_CODE.NOT_FOUND,
      message: "Nenhuma estadia em check-in encontrada para este quarto.",
    });
  });

  it("retorna 409 quando quarto possui multiplas estadias em check-in", async () => {
    vi.mocked(createServerClient).mockReturnValue(
      createSupabaseMock({
        rooms: [{ id: "room-102", hotel_id: "hotel-1", room_number: "102" }],
        candidateStays: [
          { id: "stay-1", room_id: "room-102", stay_status: "checked_in" },
          { id: "stay-2", room_id: "room-102", stay_status: "checked_in" },
        ],
      }) as any,
    );
    const app = await createTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/admin/stays/checkout-candidate?room_number=102",
      headers: {
        authorization: `Bearer ${createToken()}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: ADMIN_ERROR_CODE.CONFLICT,
      message:
        "Mais de uma estadia em check-in encontrada para este quarto. Use o calendario de reservas.",
    });
  });

  it("retorna painel operacional da estadia checked-in do quarto", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T13:00:00.000Z"));
    vi.mocked(createServerClient).mockReturnValue(
      createSupabaseMock({
        rooms: [{ id: "room-102", hotel_id: "hotel-1", room_number: "102" }],
        candidateStays: [
          { id: "stay-2", room_id: "room-102", stay_status: "checked_in" },
        ],
      }) as any,
    );
    const app = await createTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/admin/stays/checkout-candidate?room_number=102",
      headers: {
        authorization: `Bearer ${createToken()}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      item: {
        stay: {
          id: "stay-2",
          room_number: "102",
          customer_name: "Bruno Lima",
          stay_status: "checked_in",
        },
        eligibility: {
          can_checkout: true,
          checkout_block_reason: null,
        },
      },
    });
  });
});
