import type { AdminSeason } from "@hotel/shared";
import { applyHotelContextFilter } from "../common/hotelContextFilter";
import { createServerClient } from "../common/supabaseServer";
import { isSupabaseConflictError, isSupabaseForeignKeyError, isSupabaseNotFoundError } from "./supabaseError";

const SEASON_SELECT_FIELDS = "id,hotel_id,name,start_date,end_date,is_active,created_at,updated_at";

export type SeasonWriteResult = "ok" | "conflict" | "not-found";

export interface SeasonsRepository {
  listSeasons(activeHotelId: string): Promise<AdminSeason[]>;
  createSeason(activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: SeasonWriteResult; item?: AdminSeason }>;
  updateSeason(id: string, activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: SeasonWriteResult; item?: AdminSeason }>;
  deleteSeason(id: string, activeHotelId: string): Promise<SeasonWriteResult>;
}

class SupabaseSeasonsRepository implements SeasonsRepository {
  async listSeasons(activeHotelId: string): Promise<AdminSeason[]> {
    const supabase = createServerClient();
    let query = supabase.from("seasons").select(SEASON_SELECT_FIELDS);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.order("start_date", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as AdminSeason[];
  }

  async createSeason(activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: SeasonWriteResult; item?: AdminSeason }> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("seasons")
      .insert({ ...payload, hotel_id: activeHotelId })
      .select(SEASON_SELECT_FIELDS)
      .single();

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data as AdminSeason };
  }

  async updateSeason(id: string, activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: SeasonWriteResult; item?: AdminSeason }> {
    const supabase = createServerClient();
    let query = supabase.from("seasons").update(payload).eq("id", id);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.select(SEASON_SELECT_FIELDS).single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return { result: "not-found" };
      }

      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data as AdminSeason };
  }

  async deleteSeason(id: string, activeHotelId: string): Promise<SeasonWriteResult> {
    const supabase = createServerClient();
    let query = supabase.from("seasons").delete().eq("id", id);
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

export function createSeasonsRepository(): SeasonsRepository {
  return new SupabaseSeasonsRepository();
}
