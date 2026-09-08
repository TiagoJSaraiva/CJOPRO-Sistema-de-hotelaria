import type {
  Json,
  OperationalPendingAction,
  OperationalPendingList,
  OperationalPendingQuery,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";
export interface OperationalPendingRepository {
  list(
    hotelId: string,
    userId: string,
    permissions: string[],
    filters: OperationalPendingQuery,
  ): Promise<OperationalPendingList>;
  act(
    hotelId: string,
    userId: string,
    permissions: string[],
    input: OperationalPendingAction,
  ): Promise<string>;
  reconcile(hotelId: string): Promise<string>;
}
function result(data: Json): string {
  return data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    typeof data.result === "string"
    ? data.result
    : "failed";
}
export function createOperationalPendingRepository(): OperationalPendingRepository {
  return {
    async list(hotelId, userId, permissions, filters) {
      const { data, error } = await createServerClient().rpc(
        "list_operational_pending",
        {
          p_hotel_id: hotelId,
          p_user_id: userId,
          p_permissions: permissions,
          p_filters: { ...filters },
        },
      );
      if (error) throw error;
      return data as unknown as OperationalPendingList;
    },
    async act(hotelId, userId, permissions, input) {
      const { data, error } = await createServerClient().rpc(
        "act_operational_pending",
        {
          p_hotel_id: hotelId,
          p_user_id: userId,
          p_permissions: permissions,
          p_ids: input.ids,
          p_action: input.action,
          ...(input.expected_version
            ? { p_version: input.expected_version }
            : {}),
        },
      );
      if (error) throw error;
      return result(data);
    },
    async reconcile(hotelId) {
      const { data, error } = await createServerClient().rpc(
        "reconcile_operational_pending",
        { p_hotel_id: hotelId },
      );
      if (error) throw error;
      return result(data);
    },
  };
}
