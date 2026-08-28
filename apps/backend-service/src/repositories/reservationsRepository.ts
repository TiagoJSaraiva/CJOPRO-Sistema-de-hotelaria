import type { AdminReservation, TablesInsert, TablesUpdate } from "@hotel/shared";
import { applyHotelContextFilter } from "../common/hotelContextFilter";
import { createServerClient } from "../common/supabaseServer";
import { isSupabaseConflictError, isSupabaseForeignKeyError, isSupabaseNotFoundError } from "./supabaseError";

const RESERVATION_SELECT_FIELDS =
  "id,hotel_id,booking_customer_id,reservation_code,guest_count,reservation_source,estimated_total_price,final_total_price,notes,created_at,updated_at";

export type ReservationWriteResult = "ok" | "conflict" | "not-found";
type ReservationCreate = Omit<TablesInsert<"reservations">, "hotel_id">;
type ReservationUpdate = Omit<TablesUpdate<"reservations">, "hotel_id">;

export interface ReservationsRepository {
  listReservations(activeHotelId: string): Promise<AdminReservation[]>;
  createReservation(activeHotelId: string, payload: ReservationCreate): Promise<{ result: ReservationWriteResult; item?: AdminReservation }>;
  updateReservation(id: string, activeHotelId: string, payload: ReservationUpdate): Promise<{ result: ReservationWriteResult; item?: AdminReservation }>;
  deleteReservation(id: string, activeHotelId: string): Promise<ReservationWriteResult>;
}

class SupabaseReservationsRepository implements ReservationsRepository {
  async listReservations(activeHotelId: string): Promise<AdminReservation[]> {
    const supabase = createServerClient();
    let query = supabase.from("reservations").select(RESERVATION_SELECT_FIELDS);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async createReservation(activeHotelId: string, payload: ReservationCreate): Promise<{ result: ReservationWriteResult; item?: AdminReservation }> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("reservations")
      .insert({ ...payload, hotel_id: activeHotelId })
      .select(RESERVATION_SELECT_FIELDS)
      .single();

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data };
  }

  async updateReservation(
    id: string,
    activeHotelId: string,
    payload: ReservationUpdate
  ): Promise<{ result: ReservationWriteResult; item?: AdminReservation }> {
    const supabase = createServerClient();
    let query = supabase.from("reservations").update(payload).eq("id", id);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.select(RESERVATION_SELECT_FIELDS).single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return { result: "not-found" };
      }

      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data };
  }

  async deleteReservation(id: string, activeHotelId: string): Promise<ReservationWriteResult> {
    const supabase = createServerClient();
    let query = supabase.from("reservations").delete().eq("id", id);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.select("id");

    if (error) {
      if (isSupabaseForeignKeyError(error) || isSupabaseConflictError(error)) {
        return "conflict";
      }

      throw error;
    }

    return data && data.length ? "ok" : "not-found";
  }
}

export function createReservationsRepository(): ReservationsRepository {
  return new SupabaseReservationsRepository();
}
