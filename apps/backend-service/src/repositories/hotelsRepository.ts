import { createServerClient } from "@hotel/shared";
import { isSupabaseConflictError, isSupabaseNotFoundError } from "./supabaseError";

const HOTEL_SELECT_FIELDS =
  "id,name,legal_name,tax_id,email,phone,address_line,address_number,address_complement,district,city,state,country,zip_code,timezone,currency,slug,is_active,created_at,updated_at";

export type HotelWriteResult = "ok" | "conflict" | "not-found";

export interface HotelsRepository {
  listHotels(): Promise<any[]>;
  createHotel(payload: Record<string, unknown>): Promise<{ result: HotelWriteResult; item?: any }>;
  updateHotel(id: string, payload: Record<string, unknown>): Promise<{ result: HotelWriteResult; item?: any }>;
  deleteHotel(id: string): Promise<HotelWriteResult>;
}

class SupabaseHotelsRepository implements HotelsRepository {
  async listHotels(): Promise<any[]> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("hotels").select(HOTEL_SELECT_FIELDS).order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async createHotel(payload: Record<string, unknown>): Promise<{ result: HotelWriteResult; item?: any }> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("hotels").insert(payload).select(HOTEL_SELECT_FIELDS).single();

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data };
  }

  async updateHotel(id: string, payload: Record<string, unknown>): Promise<{ result: HotelWriteResult; item?: any }> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("hotels").update(payload).eq("id", id).select(HOTEL_SELECT_FIELDS).single();

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

  async deleteHotel(id: string): Promise<HotelWriteResult> {
    const supabase = createServerClient();
    const { data, error } = await supabase.from("hotels").delete().eq("id", id).select("id");

    if (error) {
      throw error;
    }

    return data && data.length ? "ok" : "not-found";
  }
}

export function createHotelsRepository(): HotelsRepository {
  return new SupabaseHotelsRepository();
}