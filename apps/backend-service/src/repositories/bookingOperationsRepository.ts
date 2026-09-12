import { createServerClient } from "../common/supabaseServer";

export type BookingOperationResult = { result: string; id?: string; context?: unknown; [key: string]: unknown };
type RpcClient = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: Error | null }> };
export interface BookingOperationsRepository {
  query(name: string, args?: Record<string, unknown>): Promise<unknown>;
  mutate(name: string, args?: Record<string, unknown>): Promise<BookingOperationResult>;
}
export function createBookingOperationsRepository(client?: RpcClient): BookingOperationsRepository {
  const rpc = () => client ?? (createServerClient() as unknown as RpcClient);
  return {
    async query(name, args = {}) { const { data, error } = await rpc().rpc(name, args); if (error) throw error; return data; },
    async mutate(name, args = {}) { const { data, error } = await rpc().rpc(name, args); if (error) throw error; return data && typeof data === "object" ? data as BookingOperationResult : { result: "invalid_response" }; },
  };
}
