import type { AdminSeasonRoomRate } from "@hotel/shared";
import { applyHotelContextFilter } from "../common/hotelContextFilter";
import { createServerClient } from "../common/supabaseServer";
import { isSupabaseConflictError, isSupabaseForeignKeyError, isSupabaseNotFoundError } from "./supabaseError";

const SEASON_ROOM_RATE_SELECT_FIELDS = "id,season_id,hotel_id,room_type,daily_rate,created_at,updated_at";

export type SeasonRoomRateWriteResult = "ok" | "conflict" | "not-found";

export interface SeasonRoomRatesRepository {
  listSeasonRoomRates(activeHotelId: string): Promise<AdminSeasonRoomRate[]>;
  createSeasonRoomRate(activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: SeasonRoomRateWriteResult; item?: AdminSeasonRoomRate }>;
  updateSeasonRoomRate(
    id: string,
    activeHotelId: string,
    payload: Record<string, unknown>
  ): Promise<{ result: SeasonRoomRateWriteResult; item?: AdminSeasonRoomRate }>;
  deleteSeasonRoomRate(id: string, activeHotelId: string): Promise<SeasonRoomRateWriteResult>;
}

class SupabaseSeasonRoomRatesRepository implements SeasonRoomRatesRepository {
  async listSeasonRoomRates(activeHotelId: string): Promise<AdminSeasonRoomRate[]> {
    const supabase = createServerClient();
    let query = supabase.from("season_room_rates").select(SEASON_ROOM_RATE_SELECT_FIELDS);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as AdminSeasonRoomRate[];
  }

  async createSeasonRoomRate(
    activeHotelId: string,
    payload: Record<string, unknown>
  ): Promise<{ result: SeasonRoomRateWriteResult; item?: AdminSeasonRoomRate }> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("season_room_rates")
      .insert({ ...payload, hotel_id: activeHotelId })
      .select(SEASON_ROOM_RATE_SELECT_FIELDS)
      .single();

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data as AdminSeasonRoomRate };
  }

  async updateSeasonRoomRate(
    id: string,
    activeHotelId: string,
    payload: Record<string, unknown>
  ): Promise<{ result: SeasonRoomRateWriteResult; item?: AdminSeasonRoomRate }> {
    const supabase = createServerClient();
    let query = supabase.from("season_room_rates").update(payload).eq("id", id);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.select(SEASON_ROOM_RATE_SELECT_FIELDS).single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return { result: "not-found" };
      }

      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data as AdminSeasonRoomRate };
  }

  async deleteSeasonRoomRate(id: string, activeHotelId: string): Promise<SeasonRoomRateWriteResult> {
    const supabase = createServerClient();
    let query = supabase.from("season_room_rates").delete().eq("id", id);
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

export function createSeasonRoomRatesRepository(): SeasonRoomRatesRepository {
  return new SupabaseSeasonRoomRatesRepository();
}
