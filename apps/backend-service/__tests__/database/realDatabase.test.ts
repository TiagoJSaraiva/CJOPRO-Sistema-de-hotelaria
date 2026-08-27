import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertLocalApiUrl } from "../../../../scripts/database.mjs";

const HOTEL_A = "10000000-0000-4000-8000-000000000001";
const HOTEL_B = "10000000-0000-4000-8000-000000000002";
const ROOM_A = "20000000-0000-4000-8000-000000000101";
const CUSTOMER_A = "30000000-0000-4000-8000-000000000001";
const LOCAL_PASSWORD = "Hotelaria123!";

type LoginPayload = { token: string };

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

describe.sequential("Supabase local com Fastify real", () => {
  let app: FastifyInstance;
  let supabase: SupabaseClient;
  let adminToken: string;
  let managerAToken: string;
  let managerBToken: string;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  async function login(email: string): Promise<string> {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: LOCAL_PASSWORD }
    });

    expect(response.statusCode).toBe(200);
    return response.json<LoginPayload>().token;
  }

  function managerHeaders(token: string, hotelId: string) {
    return {
      authorization: `Bearer ${token}`,
      "x-active-hotel-id": hotelId
    };
  }

  beforeAll(async () => {
    const apiUrl = assertLocalApiUrl(String(process.env.SUPABASE_URL || ""));
    const serviceRoleKey = String(process.env.SUPABASE_SECRET_KEY || "");
    expect(serviceRoleKey).not.toBe("");

    supabase = createClient(apiUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const module = await import("../../src/app");
    app = module.createApp();
    await app.ready();

    adminToken = await login("admin@hotelaria.local");
    managerAToken = await login("gerente.aurora@hotelaria.local");
    managerBToken = await login("gerente.horizonte@hotelaria.local");
  });

  afterAll(async () => {
    await app?.close();
  });

  it("recusa qualquer endpoint Supabase que nao seja o ambiente local fixado", () => {
    expect(() => assertLocalApiUrl("https://example.supabase.co")).toThrow(/Recusado ambiente Supabase nao local/);
    expect(() => assertLocalApiUrl("http://127.0.0.1:54322")).toThrow(/Recusado ambiente Supabase nao local/);
  });

  it("consulta todos os modulos e mantem o isolamento entre os dois hoteis", async () => {
    const globalHeaders = { authorization: `Bearer ${adminToken}` };
    const globalEndpoints = ["/admin/hotels", "/admin/permissions", "/admin/roles", "/admin/users"];

    for (const url of globalEndpoints) {
      const response = await app.inject({ method: "GET", url, headers: globalHeaders });
      expect(response.statusCode, url).toBe(200);
      expect(response.json().items.length, url).toBeGreaterThan(0);
    }

    const hotelEndpoints = [
      "/admin/rooms",
      "/admin/customers",
      "/admin/products",
      "/admin/seasons",
      "/admin/season-room-rates",
      "/admin/financial-transactions"
    ];

    for (const url of hotelEndpoints) {
      const response = await app.inject({ method: "GET", url, headers: managerHeaders(managerAToken, HOTEL_A) });
      expect(response.statusCode, url).toBe(200);
      expect(response.json().items.length, url).toBeGreaterThan(0);
    }

    const roomsA = await app.inject({ method: "GET", url: "/admin/rooms", headers: managerHeaders(managerAToken, HOTEL_A) });
    const roomsB = await app.inject({ method: "GET", url: "/admin/rooms", headers: managerHeaders(managerBToken, HOTEL_B) });
    expect(roomsA.json().items).toHaveLength(3);
    expect(roomsB.json().items).toHaveLength(3);
    expect(roomsA.json().items.map((item: { id: string }) => item.id)).not.toContain("20000000-0000-4000-8000-000000000201");
    expect(roomsB.json().items.map((item: { id: string }) => item.id)).not.toContain(ROOM_A);

    const forbiddenScope = await app.inject({
      method: "GET",
      url: "/admin/rooms",
      headers: managerHeaders(managerAToken, HOTEL_B)
    });
    expect(forbiddenScope.statusCode).toBe(403);

    const calendar = await app.inject({
      method: "GET",
      url: `/admin/reservations/calendar?start_date=${addDays(today, -2)}&days=12`,
      headers: managerHeaders(managerAToken, HOTEL_A)
    });
    expect(calendar.statusCode).toBe(200);
    expect(calendar.json().stays.length).toBeGreaterThan(0);
    expect(calendar.json().blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Limpeza programada", status: "blocked" })])
    );
  });

  it("executa CRUD representativo sem permitir alterar registros de outro hotel", async () => {
    const headers = managerHeaders(managerAToken, HOTEL_A);
    const created = await app.inject({
      method: "POST",
      url: "/admin/rooms",
      headers,
      payload: {
        room_number: "199",
        room_type: "Teste real",
        max_occupancy: 2,
        base_daily_rate: 199.9,
        status: "available"
      }
    });
    expect(created.statusCode).toBe(201);
    const createdId = created.json().item.id as string;

    const updated = await app.inject({
      method: "PUT",
      url: `/admin/rooms/${createdId}`,
      headers,
      payload: { notes: "Atualizado pelo teste real" }
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().item.notes).toBe("Atualizado pelo teste real");

    const crossHotelUpdate = await app.inject({
      method: "PUT",
      url: "/admin/rooms/20000000-0000-4000-8000-000000000201",
      headers,
      payload: { notes: "Nao deve persistir" }
    });
    expect(crossHotelUpdate.statusCode).toBe(404);

    const deleted = await app.inject({ method: "DELETE", url: `/admin/rooms/${createdId}`, headers });
    expect(deleted.statusCode).toBe(200);

    const { data: foreignRoom } = await supabase
      .from("rooms")
      .select("notes")
      .eq("id", "20000000-0000-4000-8000-000000000201")
      .single();
    expect(foreignRoom?.notes).toBe("Quarto sintetico");
  });

  it("mantem as RPCs de roles e usuarios atomicas diante de referencias invalidas", async () => {
    const roleName = "Role que nao deve existir";
    const { data: systemPermission } = await supabase
      .from("permissions")
      .select("id")
      .eq("type", "SYSTEM_PERMISSION")
      .limit(1)
      .single();

    const roleResult = await supabase.rpc("create_role_with_permissions", {
      p_name: roleName,
      p_role_type: "HOTEL_ROLE",
      p_hotel_id: HOTEL_A,
      p_permission_ids: [systemPermission!.id]
    });
    expect(roleResult.error).toBeNull();
    expect(roleResult.data?.[0]?.result).toBe("not-found");
    const { count: roleCount } = await supabase.from("roles").select("id", { count: "exact", head: true }).eq("name", roleName);
    expect(roleCount).toBe(0);

    const roleUpdateResult = await supabase.rpc("update_role_with_permissions", {
      p_id: "70000000-0000-4000-8000-000000000002",
      p_payload: { name: "Nome de role que nao deve persistir" },
      p_permission_ids: [systemPermission!.id],
      p_should_replace_permissions: true
    });
    expect(roleUpdateResult.error).toBeNull();
    expect(roleUpdateResult.data?.[0]?.result).toBe("not-found");
    const { data: preservedRole } = await supabase
      .from("roles")
      .select("name")
      .eq("id", "70000000-0000-4000-8000-000000000002")
      .single();
    expect(preservedRole?.name).toBe("Gerente local Aurora");

    const userEmail = "nao-persistir@hotelaria.local";
    const userResult = await supabase.rpc("create_user_with_roles", {
      p_name: "Usuario invalido",
      p_email: userEmail,
      p_password_hash: "hash-invalido-para-teste",
      p_is_active: true,
      p_role_assignments: [{ role_id: "ffffffff-ffff-4fff-8fff-ffffffffffff", hotel_id: HOTEL_A }]
    });
    expect(userResult.error).toBeNull();
    expect(userResult.data?.[0]?.result).toBe("not-found");
    const { count: userCount } = await supabase.from("users").select("id", { count: "exact", head: true }).eq("email", userEmail);
    expect(userCount).toBe(0);

    const userUpdateResult = await supabase.rpc("update_user_with_roles", {
      p_id: "80000000-0000-4000-8000-000000000002",
      p_payload: { name: "Nome de usuario que nao deve persistir" },
      p_role_assignments: [{ role_id: "ffffffff-ffff-4fff-8fff-ffffffffffff", hotel_id: HOTEL_A }],
      p_should_replace_roles: true
    });
    expect(userUpdateResult.error).toBeNull();
    expect(userUpdateResult.data?.[0]?.result).toBe("not-found");
    const { data: preservedUser } = await supabase
      .from("users")
      .select("name")
      .eq("id", "80000000-0000-4000-8000-000000000002")
      .single();
    expect(preservedUser?.name).toBe("Gerente Aurora");
  });

  it("persiste reserva, pagamento, check-in e checkout no fluxo HTTP real", async () => {
    const headers = managerHeaders(managerAToken, HOTEL_A);
    const bookingDate = addDays(today, 20);
    const booking = await app.inject({
      method: "POST",
      url: "/admin/reservations/calendar/booking",
      headers,
      payload: {
        booking_customer: { mode: "existing", customer_id: CUSTOMER_A },
        selected_cells: [{ room_id: ROOM_A, date: bookingDate, side: "full" }],
        reservation_source: "front_desk",
        notes: "Fluxo real de banco"
      }
    });
    expect(booking.statusCode).toBe(201);
    const bookingItem = booking.json().item as {
      reservation_id: string;
      stay_ids: string[];
      total_price: number;
    };
    const stayId = bookingItem.stay_ids[0]!;

    const payment = await app.inject({
      method: "POST",
      url: `/admin/stays/${stayId}/payments`,
      headers,
      payload: { amount: bookingItem.total_price, method: "pix", note: "Pagamento do teste real" }
    });
    expect(payment.statusCode).toBe(200);
    expect(payment.json().item.stay.total_paid).toBe(bookingItem.total_price);

    const { error: hotelWindowError } = await supabase
      .from("hotels")
      .update({
        checkin_time_start: "00:00:00",
        checkin_time_limit: "23:59:00",
        checkout_time_start: "00:00:00",
        checkout_time_limit: "23:59:00"
      })
      .eq("id", HOTEL_A);
    expect(hotelWindowError).toBeNull();

    const { error: stayDatesError } = await supabase
      .from("stays")
      .update({
        checkin_date_expected: `${today}T00:00:00.000Z`,
        checkout_date_expected: `${today}T23:00:00.000Z`
      })
      .eq("id", stayId);
    expect(stayDatesError).toBeNull();

    const checkin = await app.inject({ method: "POST", url: `/admin/stays/${stayId}/checkin`, headers });
    expect(checkin.statusCode).toBe(200);
    expect(checkin.json().item.stay.stay_status).toBe("checked_in");

    const checkout = await app.inject({ method: "POST", url: `/admin/stays/${stayId}/checkout`, headers });
    expect(checkout.statusCode).toBe(200);
    expect(checkout.json().item.stay.stay_status).toBe("checked_out");

    const { data: persistedStay, error } = await supabase
      .from("stays")
      .select("stay_status,total_paid,checkin_date_actual,checkout_date_actual")
      .eq("id", stayId)
      .single();
    expect(error).toBeNull();
    expect(persistedStay).toMatchObject({ stay_status: "checked_out", total_paid: bookingItem.total_price });
    expect(persistedStay?.checkin_date_actual).not.toBeNull();
    expect(persistedStay?.checkout_date_actual).not.toBeNull();
  });
});
