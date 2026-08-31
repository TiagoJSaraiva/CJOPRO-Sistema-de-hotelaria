import type { AdminRoom, TablesInsert, TablesUpdate } from "@hotel/shared";
import { applyHotelContextFilter } from "../common/hotelContextFilter";
import { createServerClient } from "../common/supabaseServer";
import {
  isSupabaseConflictError,
  isSupabaseForeignKeyError,
  isSupabaseNotFoundError,
} from "./supabaseError";

const ROOM_SELECT_FIELDS =
  "id,hotel_id,room_number,room_type,max_occupancy,base_daily_rate,status,notes,created_at,updated_at";

export type RoomWriteResult = "ok" | "conflict" | "not-found";
type RoomCreate = Omit<TablesInsert<"rooms">, "hotel_id">;
type RoomUpdate = Omit<TablesUpdate<"rooms">, "hotel_id">;

export interface RoomsRepository {
  listRooms(activeHotelId: string): Promise<AdminRoom[]>;
  createRoom(
    activeHotelId: string,
    payload: RoomCreate,
  ): Promise<{ result: RoomWriteResult; item?: AdminRoom }>;
  updateRoom(
    id: string,
    activeHotelId: string,
    payload: RoomUpdate,
  ): Promise<{ result: RoomWriteResult; item?: AdminRoom }>;
  deleteRoom(id: string, activeHotelId: string): Promise<RoomWriteResult>;
}

class SupabaseRoomsRepository implements RoomsRepository {
  async listRooms(activeHotelId: string): Promise<AdminRoom[]> {
    const supabase = createServerClient();
    let query = supabase.from("rooms").select(ROOM_SELECT_FIELDS);
    query = applyHotelContextFilter(query, activeHotelId);
    const [roomsResult, blocksResult] = await Promise.all([
      query.order("created_at", { ascending: false }),
      supabase
        .from("room_blocks")
        .select("room_id,status")
        .eq("hotel_id", activeHotelId)
        .is("released_at", null)
        .lte("start_date", new Date().toISOString().slice(0, 10)),
    ]);

    if (roomsResult.error || blocksResult.error) {
      throw roomsResult.error || blocksResult.error;
    }

    const effectiveStatuses = new Map(
      (blocksResult.data || []).map((block) => [block.room_id, block.status]),
    );
    return (roomsResult.data || []).map((room) => ({
      ...room,
      status: effectiveStatuses.get(room.id) || room.status,
    }));
  }

  async createRoom(
    activeHotelId: string,
    payload: RoomCreate,
  ): Promise<{ result: RoomWriteResult; item?: AdminRoom }> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("rooms")
      .insert({ ...payload, hotel_id: activeHotelId })
      .select(ROOM_SELECT_FIELDS)
      .single();

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data };
  }

  async updateRoom(
    id: string,
    activeHotelId: string,
    payload: RoomUpdate,
  ): Promise<{ result: RoomWriteResult; item?: AdminRoom }> {
    const supabase = createServerClient();
    let query = supabase.from("rooms").update(payload).eq("id", id);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.select(ROOM_SELECT_FIELDS).single();

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

  async deleteRoom(
    id: string,
    activeHotelId: string,
  ): Promise<RoomWriteResult> {
    const supabase = createServerClient();
    let query = supabase.from("rooms").delete().eq("id", id);
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

export function createRoomsRepository(): RoomsRepository {
  return new SupabaseRoomsRepository();
}
