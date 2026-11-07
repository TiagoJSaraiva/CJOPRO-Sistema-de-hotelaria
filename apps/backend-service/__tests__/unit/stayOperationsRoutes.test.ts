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
    id?: string;
    total_price_estimated: number | null;
    total_paid: number | null;
  }>;
  reservationAccountEntries?: Array<{
    id: string;
    direction: string;
    kind: string;
    amount: number;
    reversed_entry_id: string | null;
  }>;
  payments?: Array<Record<string, unknown>>;
  closure?: Record<string, unknown>;
  closeResult?: Record<string, unknown>;
  roomState?: Record<string, unknown>;
  checkinResult?: Record<string, unknown>;
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
    checkin_date_expected: "2026-05-15T17:00:00.000Z",
    checkout_date_expected: "2026-05-18T14:00:00.000Z",
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

    if (
      table === "stays" &&
      selected === "id,reservation:reservation_id(hotel_id)"
    ) {
      return {
        data:
          filters.id === "stay-2"
            ? [{ id: "stay-2", reservation: { hotel_id: "hotel-1" } }]
            : [],
        error: null,
      };
    }

    if (
      table === "stays" &&
      selected === "id,total_price_estimated,total_paid"
    ) {
      return {
        data: options.reservationStays || [
          { id: "stay-2", total_price_estimated: 960, total_paid: 960 },
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

    if (table === "reservation_account_entries") {
      return {
        data: (options.reservationAccountEntries || []).filter(
          () =>
            filters.hotel_id === "hotel-1" &&
            filters.reservation_id === "reservation-2",
        ),
        error: null,
      };
    }

    if (table === "hotels") {
      return { data: [{ currency: "BRL" }], error: null };
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
    builder.maybeSingle = vi.fn(async () => {
      const result = resolve(table, selected, filters);
      const row = result.data[0] || null;
      return { data: row, error: null };
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

  const rpc = vi.fn(async (name: string) => {
    if (name === "governance_room_state")
      return { data: options.roomState ?? null, error: null };
    if (name === "checkin_stay_with_readiness")
      return { data: options.checkinResult ?? null, error: null };
    if (name === "hotel_operational_now")
      return { data: "2026-05-18T13:00:00.000Z", error: null };
    if (name === "stay_closure_preview")
      return { data: options.closure ?? null, error: null };
    if (name === "close_stay_before_arrival")
      return { data: options.closeResult ?? { result: "ok" }, error: null };
    return { data: null, error: null };
  });
  return { from, rpc };
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
  it("retorna 403 sem permissão de calendario", async () => {
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

  it("retorna 400 quando room_number não e informado", async () => {
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
      message: "Numero do quarto obrigatório.",
    });
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("retorna 404 quando quarto não existe no hotel ativo", async () => {
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
      message: "Quarto não encontrado para o hotel ativo.",
    });
  });

  it("retorna 404 quando quarto não possui estadia em check-in", async () => {
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
          operational_now: "2026-05-18T13:00:00.000Z",
          can_checkout: true,
          checkout_block_reason: null,
        },
      },
    });
  });
});

describe("routes/stays panel reservation balance", () => {
  async function readPanel(options: SupabaseMockOptions) {
    vi.mocked(createServerClient).mockReturnValue(
      createSupabaseMock({
        panelStay: createPanelStay({
          stay_status: "confirmed",
          checkin_date_actual: null,
          total_price_estimated: 500,
          total_paid: options.reservationStays?.[0]?.total_paid ?? 0,
        }),
        reservationStays: [
          {
            id: "stay-2",
            total_price_estimated: 500,
            total_paid: options.reservationStays?.[0]?.total_paid ?? 0,
          },
        ],
        ...options,
      }) as any,
    );
    const app = await createTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/admin/stays/stay-2/panel",
      headers: {
        authorization: `Bearer ${createToken()}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
    });
    return response;
  }

  it("abate adiantamento ainda não transferido do saldo da reserva", async () => {
    const response = await readPanel({
      reservationAccountEntries: [
        {
          id: "guarantee-1",
          direction: "credit",
          kind: "guarantee",
          amount: 250,
          reversed_entry_id: null,
        },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().item.reservation).toMatchObject({
      total_due: 500,
      total_paid: 0,
      guarantee_unapplied: 250,
      payment_status: "partial",
    });
  });

  it("não desconta duas vezes o adiantamento depois da transferência", async () => {
    const response = await readPanel({
      reservationStays: [
        { id: "stay-2", total_price_estimated: 500, total_paid: 250 },
      ],
      reservationAccountEntries: [
        {
          id: "guarantee-1",
          direction: "credit",
          kind: "guarantee",
          amount: 250,
          reversed_entry_id: null,
        },
        {
          id: "transfer-1",
          direction: "debit",
          kind: "stay_transfer",
          amount: 250,
          reversed_entry_id: "guarantee-1",
        },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().item.reservation).toMatchObject({
      total_due: 500,
      total_paid: 250,
      guarantee_unapplied: 0,
      payment_status: "partial",
    });
  });
});

describe("routes/stays encerramento antes da chegada", () => {
  const confirmedStay = () =>
    createPanelStay({
      stay_status: "confirmed",
      checkin_date_actual: null,
      // O relógio do mock está em 18/05; a chegada prevista já passou do limite.
      checkin_date_expected: "2026-05-15T17:00:00.000Z",
    });

  async function close(
    action: "cancel" | "no-show",
    payload: Record<string, unknown>,
    options: SupabaseMockOptions = {},
  ) {
    const supabase = createSupabaseMock({
      panelStay: confirmedStay(),
      ...options,
    });
    vi.mocked(createServerClient).mockReturnValue(supabase as any);
    const app = await createTestApp();
    const response = await app.inject({
      method: "POST",
      url: `/admin/stays/stay-2/${action}`,
      headers: {
        authorization: `Bearer ${createToken()}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
      payload,
    });
    return { response, supabase };
  }
  const closeCalls = (supabase: { rpc: ReturnType<typeof vi.fn> }) =>
    supabase.rpc.mock.calls.filter(
      ([name]) => name === "close_stay_before_arrival",
    );

  it.each([
    ["cancel", "cancel"],
    ["no-show", "no_show"],
  ] as const)("%s encerra pela regra única do banco", async (path, action) => {
    const { response, supabase } = await close(path, {
      reason: "Pedido do hóspede",
    });
    expect(response.statusCode).toBe(200);
    expect(closeCalls(supabase)[0]?.[1]).toEqual({
      p_hotel_id: "hotel-1",
      p_stay_id: "stay-2",
      p_actor_id: "user-1",
      p_action: action,
      p_reason: "Pedido do hóspede",
    });
  });

  it.each(["cancel", "no-show"] as const)(
    "%s sem motivo é recusado antes de encerrar",
    async (path) => {
      const { response, supabase } = await close(path, { reason: "  " });
      expect(response.statusCode).toBe(400);
      expect(closeCalls(supabase)).toHaveLength(0);
    },
  );

  it("explica que a conta com pagamento precisa ser acertada antes", async () => {
    const { response } = await close(
      "cancel",
      { reason: "Pedido do hóspede" },
      { closeResult: { result: "open_account" } },
    );
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("conta da estadia");
  });

  it("não encerra estadia que já teve check-in", async () => {
    const { response, supabase } = await close(
      "cancel",
      { reason: "Pedido do hóspede" },
      { panelStay: createPanelStay() },
    );
    expect(response.statusCode).toBe(409);
    expect(closeCalls(supabase)).toHaveLength(0);
  });

  it("não aplica no-show antes do limite de check-in", async () => {
    const { response, supabase } = await close(
      "no-show",
      { reason: "Não compareceu" },
      {
        panelStay: createPanelStay({
          stay_status: "confirmed",
          checkin_date_actual: null,
          checkin_date_expected: "2026-05-30T17:00:00.000Z",
        }),
      },
    );
    expect(response.statusCode).toBe(409);
    expect(closeCalls(supabase)).toHaveLength(0);
  });

  it("o painel traz a multa e o saldo do encerramento", async () => {
    vi.mocked(createServerClient).mockReturnValue(
      createSupabaseMock({
        panelStay: confirmedStay(),
        closure: { cancel_penalty: 40, no_show_penalty: 40, balance: 50 },
      }) as any,
    );
    const app = await createTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/admin/stays/stay-2/panel",
      headers: {
        authorization: `Bearer ${createToken()}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
    });
    expect(response.json().item.closure).toEqual({
      cancel_penalty: 40,
      no_show_penalty: 40,
      balance: 50,
    });
  });
});

// QA-087: a janela vira aviso. O relógio do mock está em 18/05, 10h em São Paulo; a saída vai das 8h às
// 12h e o check-in das 14h às 22h.
describe("routes/stays janelas de entrada e saída", () => {
  const readyRoom = { readiness: "ready", blockers: [] };

  async function call(
    method: "GET" | "POST",
    url: string,
    options: SupabaseMockOptions,
    payload?: Record<string, unknown>,
  ) {
    const supabase = createSupabaseMock(options);
    vi.mocked(createServerClient).mockReturnValue(supabase as any);
    const app = await createTestApp();
    const response = await app.inject({
      method,
      url,
      headers: {
        authorization: `Bearer ${createToken()}`,
        [ACTIVE_HOTEL_HEADER_NAME]: "hotel-1",
      },
      ...(payload ? { payload } : {}),
    });
    return { response, supabase };
  }
  const rpcCalls = (
    supabase: { rpc: ReturnType<typeof vi.fn> },
    name: string,
  ) => supabase.rpc.mock.calls.filter(([called]) => called === name);

  it("a saída antes da data prevista fica disponível com aviso", async () => {
    const { response } = await call("GET", "/admin/stays/stay-2/panel", {
      panelStay: createPanelStay({
        checkout_date_expected: "2026-05-20T14:00:00.000Z",
      }),
    });
    const eligibility = response.json().item.eligibility;
    expect(eligibility.can_checkout).toBe(true);
    expect(eligibility.checkout_block_reason).toBeNull();
    expect(eligibility.checkout_window_notice).toContain(
      "antes da data prevista",
    );
    expect(eligibility.checkout_window_notice).toContain("20/05/2026");
  });

  it("a saída depois da data prevista também pede motivo", async () => {
    const { response } = await call("GET", "/admin/stays/stay-2/panel", {
      panelStay: createPanelStay({
        checkout_date_expected: "2026-05-16T14:00:00.000Z",
      }),
    });
    expect(response.json().item.eligibility.checkout_window_notice).toContain(
      "depois da data prevista",
    );
  });

  it("na data e no horário previstos, a saída não pede motivo", async () => {
    const { response } = await call("GET", "/admin/stays/stay-2/panel", {});
    expect(response.json().item.eligibility).toMatchObject({
      can_checkout: true,
      checkout_window_notice: null,
    });
  });

  it("no dia previsto, o check-in fora do horário fica disponível com aviso", async () => {
    const { response } = await call("GET", "/admin/stays/stay-2/panel", {
      roomState: readyRoom,
      panelStay: createPanelStay({
        stay_status: "confirmed",
        checkin_date_actual: null,
        checkin_date_expected: "2026-05-18T17:00:00.000Z",
      }),
    });
    const eligibility = response.json().item.eligibility;
    expect(eligibility.can_checkin).toBe(true);
    expect(eligibility.checkin_window_notice).toContain("14:00");
    expect(eligibility.checkin_window_notice).toContain("22:00");
  });

  it("o check-in continua só na data prevista", async () => {
    const { response } = await call("GET", "/admin/stays/stay-2/panel", {
      roomState: readyRoom,
      panelStay: createPanelStay({
        stay_status: "confirmed",
        checkin_date_actual: null,
        checkin_date_expected: "2026-05-19T17:00:00.000Z",
      }),
    });
    expect(response.json().item.eligibility).toMatchObject({
      can_checkin: false,
      checkin_window_notice: null,
      checkin_block_reason: "Check-in permitido apenas na data esperada.",
    });
  });

  it("check-in fora do horário sem motivo é recusado antes do banco", async () => {
    const { response, supabase } = await call(
      "POST",
      "/admin/stays/stay-2/checkin",
      {
        roomState: readyRoom,
        panelStay: createPanelStay({
          stay_status: "confirmed",
          checkin_date_actual: null,
          checkin_date_expected: "2026-05-18T17:00:00.000Z",
        }),
      },
      { window_reason: "   " },
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("motivo");
    expect(rpcCalls(supabase, "checkin_stay_with_readiness")).toHaveLength(0);
  });

  it("check-in fora do horário leva o motivo ao banco", async () => {
    const { supabase } = await call(
      "POST",
      "/admin/stays/stay-2/checkin",
      {
        roomState: readyRoom,
        checkinResult: { result: "ok" },
        panelStay: createPanelStay({
          stay_status: "confirmed",
          checkin_date_actual: null,
          checkin_date_expected: "2026-05-18T17:00:00.000Z",
        }),
      },
      { window_reason: " Voo antecipado " },
    );
    expect(
      rpcCalls(supabase, "checkin_stay_with_readiness")[0]?.[1],
    ).toMatchObject({
      p_window_reason: "Voo antecipado",
    });
  });

  it("saída fora da data sem motivo é recusada antes do banco", async () => {
    const { response, supabase } = await call(
      "POST",
      "/admin/stays/stay-2/checkout",
      {
        panelStay: createPanelStay({
          checkout_date_expected: "2026-05-20T14:00:00.000Z",
        }),
      },
      {},
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("motivo");
    expect(rpcCalls(supabase, "checkout_stay_account_stage4")).toHaveLength(0);
  });
});
