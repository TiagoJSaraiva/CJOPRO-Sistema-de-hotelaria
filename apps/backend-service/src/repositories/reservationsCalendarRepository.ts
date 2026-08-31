import type {
  AdminReservationCalendarResponse,
  AdminReservationCalendarRoomBlock,
  AdminReservationCalendarRoomRow,
  AdminReservationCalendarStayBlock,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

type StayRow = {
  id: string;
  room_id: string;
  reservation_id: string;
  stay_status?: string | null;
  total_price_estimated?: number | null;
  total_paid?: number | null;
  checkin_date_expected: string;
  checkout_date_expected: string;
  reservations?: {
    reservation_code?: string | null;
    customers?: {
      full_name?: string | null;
    } | null;
  } | null;
};

function derivePaymentStatus(
  totalPaid: number,
  totalDue: number,
): AdminReservationCalendarStayBlock["stay_payment_status"] {
  if (totalDue <= 0) {
    return "paid";
  }
  if (totalPaid <= 0) {
    return "pending";
  }
  if (totalPaid >= totalDue) {
    return "paid";
  }
  return "partial";
}

export interface ReservationsCalendarRepository {
  getTimeline(
    activeHotelId: string,
    startDate: string,
    endDate: string,
  ): Promise<AdminReservationCalendarResponse>;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfDayUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function parseIsoDate(value: string): Date {
  const [yearRaw = "1970", monthRaw = "01", dayRaw = "01"] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  return new Date(Date.UTC(year, month - 1, day));
}

function buildDays(
  startDate: string,
  endDate: string,
): AdminReservationCalendarResponse["days"] {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const days: AdminReservationCalendarResponse["days"] = [];
  const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC",
  });

  for (
    let cursor = start;
    cursor <= end;
    cursor = new Date(cursor.getTime() + 86400000)
  ) {
    days.push({
      date: toIsoDate(cursor),
      day_number: cursor.getUTCDate(),
      weekday_short: weekdayFormatter.format(cursor).replace(".", ""),
    });
  }

  return days;
}

function normalizeStayBlocks(
  rows: StayRow[],
  windowStart: string,
  windowEnd: string,
): AdminReservationCalendarStayBlock[] {
  const windowStartDate = parseIsoDate(windowStart);
  const windowEndDate = parseIsoDate(windowEnd);

  return rows
    .map((stay) => {
      const checkin = startOfDayUtc(new Date(stay.checkin_date_expected));
      const checkout = startOfDayUtc(new Date(stay.checkout_date_expected));

      const startDate = checkin < windowStartDate ? windowStartDate : checkin;
      const endDate = checkout > windowEndDate ? windowEndDate : checkout;

      return {
        id: stay.id,
        room_id: stay.room_id,
        reservation_id: stay.reservation_id,
        reservation_code: stay.reservations?.reservation_code || null,
        stay_status:
          (stay.stay_status as AdminReservationCalendarStayBlock["stay_status"]) ||
          null,
        total_price_estimated:
          stay.total_price_estimated === null ||
          stay.total_price_estimated === undefined
            ? null
            : Number(stay.total_price_estimated),
        total_paid: Number(stay.total_paid || 0),
        stay_payment_status: derivePaymentStatus(
          Number(stay.total_paid || 0),
          Number(stay.total_price_estimated || 0),
        ),
        customer_name: stay.reservations?.customers?.full_name || null,
        checkin_date_expected: toIsoDate(checkin),
        checkout_date_expected: toIsoDate(checkout),
        start_date: toIsoDate(startDate),
        end_date: toIsoDate(endDate),
        start_half: checkin >= windowStartDate ? "right" : null,
        end_half: checkout <= windowEndDate ? "left" : null,
      } satisfies AdminReservationCalendarStayBlock;
    })
    .filter((item) => item.start_date <= item.end_date);
}

class SupabaseReservationsCalendarRepository implements ReservationsCalendarRepository {
  async getTimeline(
    activeHotelId: string,
    startDate: string,
    endDate: string,
  ): Promise<AdminReservationCalendarResponse> {
    const supabase = createServerClient();

    const roomsResult = await supabase
      .from("rooms")
      .select("id,room_number,room_type,max_occupancy")
      .eq("hotel_id", activeHotelId)
      .order("room_type", { ascending: true })
      .order("room_number", { ascending: true });

    if (roomsResult.error) {
      throw roomsResult.error;
    }

    const rooms = (roomsResult.data || []).map(
      (room) =>
        ({
          room_id: String(room.id),
          room_number: String(room.room_number),
          room_type: String(room.room_type),
          max_occupancy: Number(room.max_occupancy || 0),
        }) satisfies AdminReservationCalendarRoomRow,
    );

    const roomIds = rooms.map((room) => room.room_id);
    if (!roomIds.length) {
      return {
        window_start: startDate,
        window_end: endDate,
        days: buildDays(startDate, endDate),
        rooms: [],
        stays: [],
        blocks: [],
        legend: [],
      };
    }

    const staysResult = await supabase
      .from("stays")
      .select(
        "id,room_id,reservation_id,stay_status,total_price_estimated,total_paid,checkin_date_expected,checkout_date_expected,reservations:reservation_id(reservation_code,customers:booking_customer_id(full_name))",
      )
      .in("room_id", roomIds)
      .lt("checkin_date_expected", `${endDate}T23:59:59.999Z`)
      .gt("checkout_date_expected", `${startDate}T00:00:00.000Z`);

    if (staysResult.error) {
      throw staysResult.error;
    }

    let blocks: AdminReservationCalendarRoomBlock[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const blocksResult = await supabase
      .from("room_blocks")
      .select(
        "id,room_id,status,label,start_date,end_date,released_at,maintenance_occurrence_id,occurrence:maintenance_occurrence_id(occurrence_number)",
      )
      .eq("hotel_id", activeHotelId)
      .in("room_id", roomIds)
      .lte("start_date", endDate)
      .is("released_at", null);

    if (!blocksResult.error) {
      blocks = (blocksResult.data || [])
        .filter(
          (item) =>
            String(item.end_date) >= startDate || String(item.end_date) < today,
        )
        .map(
          (item) =>
            ({
              id: String(item.id),
              room_id: String(item.room_id),
              status: String(item.status || "blocked"),
              label: item.label ? String(item.label) : null,
              start_date: String(item.start_date),
              end_date:
                String(item.end_date) < today ? endDate : String(item.end_date),
              maintenance_occurrence_id: item.maintenance_occurrence_id
                ? String(item.maintenance_occurrence_id)
                : null,
              occurrence_code:
                item.occurrence &&
                !Array.isArray(item.occurrence) &&
                item.occurrence.occurrence_number
                  ? `OCO-${String(item.occurrence.occurrence_number).padStart(6, "0")}`
                  : null,
              is_overdue: String(item.end_date) < today,
            }) satisfies AdminReservationCalendarRoomBlock,
        );
    }

    return {
      window_start: startDate,
      window_end: endDate,
      days: buildDays(startDate, endDate),
      rooms,
      stays: normalizeStayBlocks(
        (staysResult.data || []) as StayRow[],
        startDate,
        endDate,
      ),
      blocks,
      legend: [
        { key: "pending", label: "Pending", color: "#0ea5e9" },
        { key: "confirmed", label: "Confirmed", color: "#22c55e" },
        { key: "no_show", label: "No show", color: "#a3a3a3" },
        { key: "canceled", label: "Canceled", color: "#f97316" },
        { key: "blocked", label: "Blocked", color: "#ef4444" },
      ],
    };
  }
}

export function createReservationsCalendarRepository(): ReservationsCalendarRepository {
  return new SupabaseReservationsCalendarRepository();
}
