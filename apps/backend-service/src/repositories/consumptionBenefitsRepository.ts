import type {
  BenefitGrantInput,
  BenefitPlanInput,
  BenefitPlanVersionInput,
  ConsumptionTransferInput,
  Json,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";
type Result = { result: string; context?: unknown; [key: string]: unknown };
type RpcCall = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: Json; error: Error | null }>;
const call = (name: string, args: Record<string, unknown>) =>
  (createServerClient().rpc as unknown as RpcCall)(name, args);
const object = (data: Json): Result =>
  data && typeof data === "object" && !Array.isArray(data)
    ? (data as Result)
    : { result: "failed" };
export interface ConsumptionBenefitsRepository {
  list(hotelId: string): Promise<unknown>;
  createPlan(
    hotelId: string,
    actorId: string,
    input: BenefitPlanInput,
  ): Promise<Result>;
  createVersion(
    hotelId: string,
    planId: string,
    actorId: string,
    input: BenefitPlanVersionInput,
  ): Promise<Result>;
  grant(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: BenefitGrantInput,
  ): Promise<Result>;
  transfer(
    hotelId: string,
    orderId: string,
    actorId: string,
    input: ConsumptionTransferInput,
    simulate: boolean,
  ): Promise<Result>;
}
export function createConsumptionBenefitsRepository(): ConsumptionBenefitsRepository {
  return {
    async list(hotelId) {
      const response = await call("list_consumption_benefit_plans", {
        p_hotel_id: hotelId,
      });
      if (response.error) throw response.error;
      return response.data;
    },
    async createPlan(hotelId, actorId, input) {
      const response = await call("save_consumption_benefit_plan", {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_input: input,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
    async createVersion(hotelId, planId, actorId, input) {
      const response = await call("create_consumption_benefit_version", {
        p_hotel_id: hotelId,
        p_plan_id: planId,
        p_actor_id: actorId,
        p_input: input,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
    async grant(hotelId, stayId, actorId, input) {
      const response = await call("grant_stay_consumption_benefit", {
        p_hotel_id: hotelId,
        p_stay_id: stayId,
        p_actor_id: actorId,
        p_version_id: input.plan_version_id,
        p_expires_at: input.expires_at,
        p_reason: input.reason,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
    async transfer(hotelId, orderId, actorId, input, simulate) {
      const response = await call("transfer_consumption_order", {
        p_hotel_id: hotelId,
        p_order_id: orderId,
        p_actor_id: actorId,
        p_input: input,
        p_simulate: simulate,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
  };
}
