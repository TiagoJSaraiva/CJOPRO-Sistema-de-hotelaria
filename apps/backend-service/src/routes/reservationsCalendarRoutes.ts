import type { FastifyInstance } from "fastify";
import {
  ADMIN_ERROR_CODE,
  PERMISSIONS,
  type AdminReservationCalendarBookingCreateInput,
  type AdminReservationCalendarBookingCreateResponse,
  type AdminReservationCalendarBookingPriceBreakdown
} from "@hotel/shared";
import { ensureAuthorizedWithScope } from "../auth/authorization";
import { adminError } from "../common/adminError";
import { requireActiveHotelId } from "../common/requireActiveHotelScope";
import { createReservationsCalendarRepository, type ReservationsCalendarRepository } from "../repositories/reservationsCalendarRepository";
import { createServerClient } from "../common/supabaseServer";
import { normalizeOptionalText } from "../common/text";
import { createCustomersRepository } from "../repositories/customersRepository";
import { createReservationsRepository } from "../repositories/reservationsRepository";
import { generateReservationCode } from "../common/reservationCodeGenerator";

const DEFAULT_DAYS = 20;
const MAX_DAYS = 60;

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(date: string, days: number): string {
  const [yearRaw = "1970", monthRaw = "01", dayRaw = "01"] = date.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

type CalendarQuery = {
  start_date?: string;
  days?: string;
};

type RoomRow = {
  id: string;
  hotel_id: string;
  room_number: string;
  room_type: string;
  base_daily_rate: number;
  status: "available" | "occupied" | "maintenance" | "blocked";
};

type SeasonRow = {
  id: string;
  start_date: string;
  end_date: string;
};

type SeasonRateRow = {
  season_id: string;
  room_type: string;
  daily_rate: number;
};

type StayConflictRow = {
  room_id: string;
  checkin_date_expected: string;
  checkout_date_expected: string;
};

type GroupedSelection = {
  room_id: string;
  start_date: string;
  end_date: string;
  checkout_date: string;
  nights: number;
};

type SelectedCellSide = "checkin" | "checkout" | "full";

function parseIsoDate(value: string): Date {
  const [yearRaw = "1970", monthRaw = "01", dayRaw = "01"] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function assertIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildContinuousGroups(selectedCells: Array<{ room_id: string; date: string }>): GroupedSelection[] {
  const groupedByRoom = new Map<string, string[]>();
  for (const cell of selectedCells) {
    const list = groupedByRoom.get(cell.room_id) || [];
    list.push(cell.date);
    groupedByRoom.set(cell.room_id, list);
  }

  const result: GroupedSelection[] = [];
  for (const [roomId, datesRaw] of groupedByRoom.entries()) {
    const dates = Array.from(new Set(datesRaw)).sort();
    if (!dates.length) continue;

    let start = dates[0]!;
    let prev = dates[0]!;
    for (let index = 1; index < dates.length; index++) {
      const current = dates[index]!;
      const prevPlusOne = dateToIso(new Date(parseIsoDate(prev).getTime() + 86400000));
      if (current !== prevPlusOne) {
        const nights = Math.round((parseIsoDate(prev).getTime() - parseIsoDate(start).getTime()) / 86400000) + 1;
        result.push({
          room_id: roomId,
          start_date: start,
          end_date: prev,
          checkout_date: dateToIso(new Date(parseIsoDate(prev).getTime() + 86400000)),
          nights
        });
        start = current;
      }
      prev = current;
    }

    const nights = Math.round((parseIsoDate(prev).getTime() - parseIsoDate(start).getTime()) / 86400000) + 1;
    result.push({
      room_id: roomId,
      start_date: start,
      end_date: prev,
      checkout_date: dateToIso(new Date(parseIsoDate(prev).getTime() + 86400000)),
      nights
    });
  }

  return result;
}

function addOccupancySide(
  map: Map<string, { left: boolean; right: boolean }>,
  roomId: string,
  date: string,
  side: "left" | "right" | "full"
): void {
  const key = `${roomId}::${date}`;
  const current = map.get(key) || { left: false, right: false };
  if (side === "full") {
    current.left = true;
    current.right = true;
  } else {
    current[side] = true;
  }
  map.set(key, current);
}

function getOverlappingSeason(dateIso: string, seasons: SeasonRow[]): SeasonRow | null {
  return (
    seasons.find((season) => {
      return dateIso >= season.start_date && dateIso <= season.end_date;
    }) || null
  );
}

async function computeBooking(
  activeHotelId: string,
  payload: Partial<AdminReservationCalendarBookingCreateInput>
): Promise<{ ok: true; data: AdminReservationCalendarBookingCreateResponse; groups: GroupedSelection[]; roomsById: Map<string, RoomRow> } | { ok: false; statusCode: number; message: string }> {
  const selectedCells = Array.isArray(payload.selected_cells) ? payload.selected_cells : [];
  if (!selectedCells.length) {
    return { ok: false, statusCode: 400, message: "Selecione ao menos uma celula livre." };
  }

  const normalizedCells = selectedCells
    .map((cell) => ({
      room_id: String(cell?.room_id || "").trim(),
      date: String(cell?.date || "").trim(),
      side: String(cell?.side || "").trim() as SelectedCellSide
    }))
    .filter((cell) => cell.room_id && cell.date);

  if (
    !normalizedCells.length ||
    normalizedCells.some(
      (cell) => !assertIsoDate(cell.date) || (cell.side !== "full" && cell.side !== "checkin" && cell.side !== "checkout")
    )
  ) {
    return { ok: false, statusCode: 400, message: "selected_cells invalido." };
  }

  const roomIds = Array.from(new Set(normalizedCells.map((cell) => cell.room_id)));
  const minDate = normalizedCells.map((cell) => cell.date).sort()[0]!;
  const maxDate = normalizedCells.map((cell) => cell.date).sort()[normalizedCells.length - 1]!;
  const supabase = createServerClient();

  const roomsResult = await supabase
    .from("rooms")
    .select("id,hotel_id,room_number,room_type,base_daily_rate,status")
    .eq("hotel_id", activeHotelId)
    .in("id", roomIds);

  if (roomsResult.error) {
    return { ok: false, statusCode: 500, message: "Falha ao consultar quartos selecionados." };
  }

  const rooms = (roomsResult.data || []) as RoomRow[];
  if (rooms.length !== roomIds.length) {
    return { ok: false, statusCode: 400, message: "Um ou mais quartos selecionados nao pertencem ao hotel ativo." };
  }
  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  if (rooms.some((room) => room.status === "maintenance" || room.status === "blocked")) {
    return { ok: false, statusCode: 409, message: "Um ou mais quartos estão indisponíveis para novas reservas." };
  }

  const conflictResult = await supabase
    .from("stays")
    .select("room_id,checkin_date_expected,checkout_date_expected")
    .in("room_id", roomIds)
    .lt("checkin_date_expected", `${maxDate}T23:59:59.999Z`)
    .gt("checkout_date_expected", `${minDate}T00:00:00.000Z`);

  if (conflictResult.error) {
    return { ok: false, statusCode: 500, message: "Falha ao validar conflitos de disponibilidade." };
  }

  const occupiedByCell = new Map<string, { left: boolean; right: boolean }>();
  for (const stay of (conflictResult.data || []) as StayConflictRow[]) {
    const checkinDate = dateToIso(new Date(stay.checkin_date_expected));
    const checkoutDate = dateToIso(new Date(stay.checkout_date_expected));

    addOccupancySide(occupiedByCell, stay.room_id, checkinDate, "right");
    addOccupancySide(occupiedByCell, stay.room_id, checkoutDate, "left");

    const internalStart = addDays(checkinDate, 1);
    const internalEnd = addDays(checkoutDate, -1);
    for (let cursor = internalStart; cursor <= internalEnd; cursor = addDays(cursor, 1)) {
      addOccupancySide(occupiedByCell, stay.room_id, cursor, "full");
    }
  }

  for (const cell of normalizedCells) {
    const key = `${cell.room_id}::${cell.date}`;
    const occupied = occupiedByCell.get(key) || { left: false, right: false };
    const hasConflict =
      cell.side === "full" ? occupied.left || occupied.right : cell.side === "checkin" ? occupied.right : occupied.left;
    if (hasConflict) {
      return { ok: false, statusCode: 409, message: "Conflito de disponibilidade em uma ou mais celulas selecionadas." };
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const blocksResult = await supabase
    .from("room_blocks")
    .select("room_id,start_date,end_date,released_at")
    .eq("hotel_id", activeHotelId)
    .in("room_id", roomIds)
    .is("released_at", null)
    .lte("start_date", maxDate);
  if (blocksResult.error) {
    return { ok: false, statusCode: 500, message: "Falha ao validar bloqueios de manutenção." };
  }
  const blockedSelection = normalizedCells.some((cell) =>
    ((blocksResult.data || []) as Array<{ room_id: string; start_date: string; end_date: string; released_at: string | null }>).some((block) => {
      const effectiveEnd = block.end_date < today ? "9999-12-31" : block.end_date;
      return block.room_id === cell.room_id && cell.date >= block.start_date && cell.date <= effectiveEnd;
    })
  );
  if (blockedSelection) {
    return { ok: false, statusCode: 409, message: "Um ou mais quartos estão bloqueados por manutenção." };
  }

  const seasonsResult = await supabase
    .from("seasons")
    .select("id,start_date,end_date")
    .eq("hotel_id", activeHotelId)
    .lte("start_date", maxDate)
    .gte("end_date", minDate);

  if (seasonsResult.error) {
    return { ok: false, statusCode: 500, message: "Falha ao consultar temporadas." };
  }
  const seasons = (seasonsResult.data || []) as SeasonRow[];
  const seasonIds = Array.from(new Set(seasons.map((item) => item.id)));

  let ratesByKey = new Map<string, number>();
  if (seasonIds.length) {
    const ratesResult = await supabase
      .from("season_room_rates")
      .select("season_id,room_type,daily_rate")
      .eq("hotel_id", activeHotelId)
      .in("season_id", seasonIds);
    if (ratesResult.error) {
      return { ok: false, statusCode: 500, message: "Falha ao consultar tarifas de temporada." };
    }
    ratesByKey = new Map(
      ((ratesResult.data || []) as SeasonRateRow[]).map((row) => [`${row.season_id}::${row.room_type}`, Number(row.daily_rate || 0)])
    );
  }

  const breakdown: AdminReservationCalendarBookingPriceBreakdown[] = [];
  let totalPrice = 0;
  for (const cell of normalizedCells.filter((item) => item.side !== "checkout")) {
    const room = roomsById.get(cell.room_id)!;
    const season = getOverlappingSeason(cell.date, seasons);
    const extra = season ? ratesByKey.get(`${season.id}::${room.room_type}`) || 0 : 0;
    const base = Number(room.base_daily_rate || 0);
    const finalDailyRate = base + extra;
    totalPrice += finalDailyRate;
    breakdown.push({
      room_id: room.id,
      room_number: room.room_number,
      room_type: room.room_type,
      date: cell.date,
      base_daily_rate: base,
      season_extra_rate: extra,
      final_daily_rate: finalDailyRate
    });
  }

  const groups = buildContinuousGroups(normalizedCells.filter((item) => item.side !== "checkout"));
  if (!groups.length) {
    return {
      ok: false,
      statusCode: 400,
      message: "Selecione ao menos 1 diaria valida para compor uma estadia."
    };
  }
  if (groups.some((group) => group.nights < 1)) {
    return {
      ok: false,
      statusCode: 400,
      message: "Cada sequencia selecionada deve ter no mínimo 1 diaria."
    };
  }
  return {
    ok: true,
    groups,
    roomsById,
    data: {
      total_price: Number(totalPrice.toFixed(2)),
      nights_count: normalizedCells.length,
      rooms_count: roomIds.length,
      breakdown: breakdown.sort((a, b) => {
        if (a.room_type !== b.room_type) return a.room_type.localeCompare(b.room_type);
        if (a.room_number !== b.room_number) return a.room_number.localeCompare(b.room_number);
        return a.date.localeCompare(b.date);
      })
    }
  };
}

export function registerReservationsCalendarRoutes(
  app: FastifyInstance,
  repository: ReservationsCalendarRepository = createReservationsCalendarRepository()
): void {
  app.get<{ Querystring: CalendarQuery }>("/admin/reservations/calendar", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS);
    if (!auth) return;

    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const today = new Date().toISOString().slice(0, 10);
    const startDate = String(request.query?.start_date || today).trim();

    if (!isValidIsoDate(startDate)) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "start_date invalido. Use o formato YYYY-MM-DD."));
    }

    const requestedDays = Number(String(request.query?.days || DEFAULT_DAYS));
    if (!Number.isFinite(requestedDays) || requestedDays < 1 || requestedDays > MAX_DAYS) {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, `days invalido. Informe um valor entre 1 e ${MAX_DAYS}.`));
    }

    const days = Math.floor(requestedDays);
    const endDate = addDays(startDate, days - 1);

    const timeline = await repository.getTimeline(activeHotelId, startDate, endDate).catch((error) => {
      request.log.error(error);
      return null;
    });

    if (!timeline) {
      return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao consultar calendário de reservas."));
    }

    return reply.send(timeline);
  });

  app.post<{ Body: Partial<AdminReservationCalendarBookingCreateInput> }>("/admin/reservations/calendar/booking/simulate", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS);
    if (!auth) return;
    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const computed = await computeBooking(activeHotelId, request.body || {});
    if (!computed.ok) {
      return reply.status(computed.statusCode).send(adminError(ADMIN_ERROR_CODE.VALIDATION, computed.message));
    }
    return reply.send({ item: computed.data });
  });

  app.post<{ Body: Partial<AdminReservationCalendarBookingCreateInput> }>("/admin/reservations/calendar/booking", async (request, reply) => {
    const auth = ensureAuthorizedWithScope(request, reply, PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS);
    if (!auth) return;
    const activeHotelId = requireActiveHotelId(reply, auth.activeHotelId);
    if (!activeHotelId) return;

    const payload = request.body || {};
    const computed = await computeBooking(activeHotelId, payload);
    if (!computed.ok) {
      const code = computed.statusCode === 409 ? ADMIN_ERROR_CODE.CONFLICT : ADMIN_ERROR_CODE.VALIDATION;
      return reply.status(computed.statusCode).send(adminError(code, computed.message));
    }

    let bookingCustomerId: string | null = null;
    const bookingCustomer = payload.booking_customer;
    if (!bookingCustomer || typeof bookingCustomer !== "object") {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "booking_customer obrigatorio."));
    }

    if (bookingCustomer.mode === "existing") {
      bookingCustomerId = normalizeOptionalText(bookingCustomer.customer_id);
      if (!bookingCustomerId) {
        return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "customer_id obrigatorio para cliente existente."));
      }
    } else if (bookingCustomer.mode === "create_inline") {
      const customersRepository = createCustomersRepository();
      const createCustomerResult = await customersRepository.createCustomer(activeHotelId, {
        full_name: normalizeOptionalText(bookingCustomer.full_name) || "",
        document_number: normalizeOptionalText(bookingCustomer.document_number) || "",
        document_type: normalizeOptionalText(bookingCustomer.document_type) || "",
        birth_date: normalizeOptionalText(bookingCustomer.birth_date) || "",
        email: normalizeOptionalText(bookingCustomer.email),
        mobile_phone: normalizeOptionalText(bookingCustomer.mobile_phone),
        phone: normalizeOptionalText(bookingCustomer.phone),
        nationality: normalizeOptionalText(bookingCustomer.nationality),
        notes: normalizeOptionalText(bookingCustomer.notes)
      });
      if (createCustomerResult.result !== "ok" || !createCustomerResult.item) {
        return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Falha ao criar cliente inline."));
      }
      bookingCustomerId = createCustomerResult.item.id;
    } else {
      return reply.status(400).send(adminError(ADMIN_ERROR_CODE.VALIDATION, "Modo de booking_customer invalido."));
    }

    const reservationsRepository = createReservationsRepository();
    let reservationCode: string | null = null;
    for (let attempts = 0; attempts < 10; attempts++) {
      const candidate = generateReservationCode();
      const existing = await reservationsRepository.listReservations(activeHotelId).catch(() => []);
      if (!existing.some((item) => item.reservation_code === candidate)) {
        reservationCode = candidate;
        break;
      }
    }
    if (!reservationCode) {
      return reply.status(500).send(adminError(ADMIN_ERROR_CODE.INTERNAL, "Falha ao gerar codigo de reserva."));
    }

    const createReservationResult = await reservationsRepository.createReservation(activeHotelId, {
      booking_customer_id: bookingCustomerId,
      reservation_code: reservationCode,
      guest_count: computed.data.rooms_count,
      reservation_source: payload.reservation_source ?? null,
      estimated_total_price: computed.data.total_price,
      final_total_price: computed.data.total_price,
      notes: normalizeOptionalText(payload.notes)
    });

    if (createReservationResult.result !== "ok" || !createReservationResult.item) {
      return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Falha ao criar reserva."));
    }

    const reservationId = createReservationResult.item.id;
    const supabase = createServerClient();
    const createdStayIds: string[] = [];
    for (const group of computed.groups) {
      const room = computed.roomsById.get(group.room_id)!;
      const groupTotal = computed.data.breakdown
        .filter((item) => item.room_id === group.room_id && item.date >= group.start_date && item.date <= group.end_date)
        .reduce((sum, item) => sum + item.final_daily_rate, 0);
      const { data: stayData, error: stayError } = await supabase
        .from("stays")
        .insert({
          reservation_id: reservationId,
          room_id: room.id,
          stay_status: "confirmed",
          applied_daily_rate: Number((groupTotal / group.nights).toFixed(2)),
          total_price_estimated: Number(groupTotal.toFixed(2)),
          checkin_date_expected: `${group.start_date}T12:00:00.000Z`,
          checkout_date_expected: `${group.checkout_date}T12:00:00.000Z`
        })
        .select("id")
        .single();
      if (stayError || !stayData?.id) {
        request.log.error(
          {
            stayError,
            reservationId,
            group,
            roomId: room.id
          },
          "Falha ao inserir stay no fluxo de booking do calendário"
        );
        await supabase.from("stays").delete().eq("reservation_id", reservationId);
        await reservationsRepository.deleteReservation(reservationId, activeHotelId);
        const details =
          stayError && typeof stayError === "object"
            ? [String((stayError as { code?: string }).code || ""), String((stayError as { message?: string }).message || "")]
                .filter(Boolean)
                .join(" | ") || undefined
            : undefined;
        return reply.status(409).send(adminError(ADMIN_ERROR_CODE.CONFLICT, "Falha ao criar estadias da reserva.", details));
      }
      createdStayIds.push(String(stayData.id));
    }

    const response: AdminReservationCalendarBookingCreateResponse = {
      reservation_id: reservationId,
      reservation_code: reservationCode,
      customer_id: bookingCustomerId || undefined,
      stay_ids: createdStayIds,
      total_price: computed.data.total_price,
      nights_count: computed.data.nights_count,
      rooms_count: computed.data.rooms_count,
      breakdown: computed.data.breakdown
    };
    return reply.status(201).send({ item: response });
  });
}
