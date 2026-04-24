import type { AdminCustomer } from "@hotel/shared";
import { applyHotelContextFilter } from "../common/hotelContextFilter";
import { createServerClient } from "../common/supabaseServer";
import { isSupabaseConflictError, isSupabaseForeignKeyError, isSupabaseNotFoundError } from "./supabaseError";

const CUSTOMER_SELECT_FIELDS = "id,hotel_id,full_name,document_number,document_type,email,mobile_phone,phone,birth_date,nationality,notes,created_at,updated_at";

export type CustomerWriteResult = "ok" | "conflict" | "not-found";

export interface CustomersRepository {
  listCustomers(activeHotelId: string): Promise<AdminCustomer[]>;
  createCustomer(activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: CustomerWriteResult; item?: AdminCustomer }>;
  updateCustomer(id: string, activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: CustomerWriteResult; item?: AdminCustomer }>;
  deleteCustomer(id: string, activeHotelId: string): Promise<CustomerWriteResult>;
}

class SupabaseCustomersRepository implements CustomersRepository {
  async listCustomers(activeHotelId: string): Promise<AdminCustomer[]> {
    const supabase = createServerClient();
    let query = supabase.from("customers").select(CUSTOMER_SELECT_FIELDS);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as AdminCustomer[];
  }

  async createCustomer(activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: CustomerWriteResult; item?: AdminCustomer }> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("customers")
      .insert({ ...payload, hotel_id: activeHotelId })
      .select(CUSTOMER_SELECT_FIELDS)
      .single();

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data as AdminCustomer };
  }

  async updateCustomer(id: string, activeHotelId: string, payload: Record<string, unknown>): Promise<{ result: CustomerWriteResult; item?: AdminCustomer }> {
    const supabase = createServerClient();
    let query = supabase.from("customers").update(payload).eq("id", id);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.select(CUSTOMER_SELECT_FIELDS).single();

    if (error) {
      if (isSupabaseNotFoundError(error)) {
        return { result: "not-found" };
      }

      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data as AdminCustomer };
  }

  async deleteCustomer(id: string, activeHotelId: string): Promise<CustomerWriteResult> {
    const supabase = createServerClient();
    let query = supabase.from("customers").delete().eq("id", id);
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

export function createCustomersRepository(): CustomersRepository {
  return new SupabaseCustomersRepository();
}
