import type {
  AdminFinancialTransaction,
  TablesInsert,
  TablesUpdate,
} from "@hotel/shared";
import { applyHotelContextFilter } from "../common/hotelContextFilter";
import { createServerClient } from "../common/supabaseServer";
import {
  isSupabaseConflictError,
  isSupabaseForeignKeyError,
  isSupabaseNotFoundError,
} from "./supabaseError";

const TRANSACTION_SELECT_FIELDS =
  "id,hotel_id,type,category,amount,currency,description,status,stay_id,reservation_id,payment_method,paid_at,due_date,counterparty,cost_center,reference_code,created_by,created_at,updated_at";

export type FinancialTransactionWriteResult = "ok" | "conflict" | "not-found";
type FinancialTransactionCreate = Omit<
  TablesInsert<"financial_transactions">,
  "hotel_id"
>;
type FinancialTransactionUpdate = Omit<
  TablesUpdate<"financial_transactions">,
  "hotel_id"
>;

export interface FinancialTransactionsRepository {
  listFinancialTransactions(
    activeHotelId: string,
  ): Promise<AdminFinancialTransaction[]>;
  createFinancialTransaction(
    activeHotelId: string,
    payload: FinancialTransactionCreate,
  ): Promise<{
    result: FinancialTransactionWriteResult;
    item?: AdminFinancialTransaction;
  }>;
  updateFinancialTransaction(
    id: string,
    activeHotelId: string,
    payload: FinancialTransactionUpdate,
  ): Promise<{
    result: FinancialTransactionWriteResult;
    item?: AdminFinancialTransaction;
  }>;
  deleteFinancialTransaction(
    id: string,
    activeHotelId: string,
  ): Promise<FinancialTransactionWriteResult>;
}

class SupabaseFinancialTransactionsRepository implements FinancialTransactionsRepository {
  async listFinancialTransactions(
    activeHotelId: string,
  ): Promise<AdminFinancialTransaction[]> {
    const supabase = createServerClient();
    let query = supabase
      .from("financial_transactions")
      .select(TRANSACTION_SELECT_FIELDS);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async createFinancialTransaction(
    activeHotelId: string,
    payload: FinancialTransactionCreate,
  ): Promise<{
    result: FinancialTransactionWriteResult;
    item?: AdminFinancialTransaction;
  }> {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("financial_transactions")
      .insert({ ...payload, hotel_id: activeHotelId })
      .select(TRANSACTION_SELECT_FIELDS)
      .single();

    if (error) {
      if (isSupabaseConflictError(error)) {
        return { result: "conflict" };
      }

      throw error;
    }

    return { result: "ok", item: data };
  }

  async updateFinancialTransaction(
    id: string,
    activeHotelId: string,
    payload: FinancialTransactionUpdate,
  ): Promise<{
    result: FinancialTransactionWriteResult;
    item?: AdminFinancialTransaction;
  }> {
    const supabase = createServerClient();
    let query = supabase
      .from("financial_transactions")
      .update(payload)
      .eq("id", id);
    query = applyHotelContextFilter(query, activeHotelId);
    const { data, error } = await query
      .select(TRANSACTION_SELECT_FIELDS)
      .single();

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

  async deleteFinancialTransaction(
    id: string,
    activeHotelId: string,
  ): Promise<FinancialTransactionWriteResult> {
    const supabase = createServerClient();
    let query = supabase.from("financial_transactions").delete().eq("id", id);
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

export function createFinancialTransactionsRepository(): FinancialTransactionsRepository {
  return new SupabaseFinancialTransactionsRepository();
}
