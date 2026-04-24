import type { AdminProduct } from "@hotel/shared";
import { applyHotelContextFilter } from "../common/hotelContextFilter";
import { createServerClient } from "../common/supabaseServer";
import { isSupabaseConflictError, isSupabaseForeignKeyError, isSupabaseNotFoundError } from "./supabaseError";

const PRODUCT_SELECT_FIELDS = "id,hotel_id,name,category,unit_price,status,created_at,updated_at";

export type ProductWriteResult = "ok" | "conflict" | "not-found";

export interface ProductsRepository {
  listProducts(activeHotelId: string): Promise<AdminProduct[]>;
  createProduct(activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: ProductWriteResult; item?: AdminProduct }>;
  updateProduct(id: string, activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: ProductWriteResult; item?: AdminProduct }>;
  deleteProduct(id: string, activeHotelId: string): Promise<ProductWriteResult>;
}

class SupabaseProductsRepository implements ProductsRepository {
  async listProducts(activeHotelId: string): Promise<AdminProduct[]> {
    const supabase = createServerClient();
    let query = supabase.from("products").select(PRODUCT_SELECT_FIELDS);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as AdminProduct[];
  }

  async createProduct(activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: ProductWriteResult; item?: AdminProduct }> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("products")
      .insert({ ...payload, hotel_id: activeHotelId })
      .select(PRODUCT_SELECT_FIELDS)
      .single();

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data as AdminProduct };
  }

  async updateProduct(id: string, activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: ProductWriteResult; item?: AdminProduct }> {
    const supabase = createServerClient();
    let query = supabase.from("products").update(payload).eq("id", id);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.select(PRODUCT_SELECT_FIELDS).single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return { result: "not-found" };
      }

      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data as AdminProduct };
  }

  async deleteProduct(id: string, activeHotelId: string): Promise<ProductWriteResult> {
    const supabase = createServerClient();
    let query = supabase.from("products").delete().eq("id", id);
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

export function createProductsRepository(): ProductsRepository {
  return new SupabaseProductsRepository();
}
