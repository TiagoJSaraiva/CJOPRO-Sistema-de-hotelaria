import type { AdminReservation } from "@hotel/shared";
import { applyHotelContextFilter } from "../common/hotelContextFilter";
import { createServerClient } from "../common/supabaseServer";
import { isSupabaseConflictError, isSupabaseForeignKeyError, isSupabaseNotFoundError } from "./supabaseError";

const RESERVATION_SELECT_FIELDS =
  "id,hotel_id,booking_customer_id,reservation_code,planned_checkin_date,planned_checkout_date,actual_checkin_date,actual_checkout_date,guest_count,reservation_status,reservation_source,payment_status,estimated_total_amount,final_total_amount,notes,created_at,updated_at";

export type ReservationWriteResult = "ok" | "conflict" | "not-found";

export interface ReservationsRepository {
  listReservations(activeHotelId: string): Promise<AdminReservation[]>;
  createReservation(activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: ReservationWriteResult; item?: AdminReservation }>;
  updateReservation(id: string, activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: ReservationWriteResult; item?: AdminReservation }>;
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

    return (data || []) as AdminReservation[];
  }

  async createReservation(activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: ReservationWriteResult; item?: AdminReservation }> {
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

    return { result: "ok", item: data as AdminReservation };
  }

  async updateReservation(
    id: string,
    activeHotelId: string,
    payload: Record<string, unknown>
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

    return { result: "ok", item: data as AdminReservation };
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
