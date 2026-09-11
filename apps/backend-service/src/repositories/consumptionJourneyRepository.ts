import type {
  ConsumptionServiceAction,
  ConsumptionServiceOrderCreate,
  Json,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

type RpcValue = { result: string; order_id?: string; context?: unknown };
const value = (data: Json): RpcValue =>
  data && typeof data === "object" && !Array.isArray(data)
    ? (data as RpcValue)
    : { result: "failed" };

type RpcCall = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: Json; error: Error | null }>;
const call = (name: string, args: Record<string, unknown>) =>
  (createServerClient().rpc as unknown as RpcCall)(name, args);

export interface ConsumptionJourneyRepository {
  board(
    hotelId: string,
    filters: { status?: string; point_id?: string; search?: string },
  ): Promise<unknown>;
  serviceOrder(hotelId: string, id: string): Promise<unknown | null>;
  createServiceOrder(
    hotelId: string,
    actorId: string,
    input: ConsumptionServiceOrderCreate,
  ): Promise<RpcValue>;
  actOnServiceOrder(
    hotelId: string,
    actorId: string,
    id: string,
    input: ConsumptionServiceAction,
  ): Promise<RpcValue>;
}

export function createConsumptionJourneyRepository(): ConsumptionJourneyRepository {
  return {
    async board(hotelId, filters) {
      const { data, error } = await call("list_consumption_service_orders", {
        p_hotel_id: hotelId,
        p_status: filters.status,
        p_point_id: filters.point_id,
        p_search: filters.search,
      });
      if (error) throw error;
      return data;
    },
    async serviceOrder(hotelId, id) {
      const { data, error } = await call("get_consumption_service_order", {
        p_hotel_id: hotelId,
        p_order_id: id,
      });
      if (error) throw error;
      return data;
    },
    async createServiceOrder(hotelId, actorId, input) {
      const { data, error } = await call("create_consumption_service_order", {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_stay_id: input.stay_id,
        p_point_id: input.point_id,
        p_guest_customer_id: input.guest_customer_id,
        p_mode: input.mode,
        p_expected_at: input.expected_at,
        p_notes: input.notes,
        p_items: input.items as unknown as Json,
        p_idempotency_key: input.idempotency_key,
      });
      if (error) throw error;
      return value(data);
    },
    async actOnServiceOrder(hotelId, actorId, id, input) {
      const { data, error } = await call("act_consumption_service_order", {
        p_hotel_id: hotelId,
        p_order_id: id,
        p_actor_id: actorId,
        p_action: input.action,
        p_expected_version: input.expected_version,
        p_assignee_id: input.assignee_id,
        p_reason: input.reason,
        p_next_action: input.next_action,
        p_idempotency_key: input.idempotency_key,
      });
      if (error) throw error;
      return value(data);
    },
  };
}
