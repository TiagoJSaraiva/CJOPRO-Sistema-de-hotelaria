import type {
  CorporateReceivablePaymentInput,
  Json,
  PostCheckoutConsumptionAction,
  PostCheckoutConsumptionCreate,
  PostCheckoutEvidenceInput,
  PostCheckoutPaymentInput,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

type Result = { result: string; context?: unknown; [key: string]: unknown };
type RpcCall = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: Json; error: Error | null }>;
const call = (name: string, args: Record<string, unknown>) => {
  const client = createServerClient();
  return (client as unknown as { rpc: RpcCall }).rpc(name, args);
};
const object = (data: Json): Result =>
  data && typeof data === "object" && !Array.isArray(data)
    ? (data as Result)
    : { result: "failed" };

export interface PostCheckoutConsumptionRepository {
  departureReview(hotelId: string, stayId: string): Promise<unknown | null>;
  list(hotelId: string, id?: string): Promise<unknown>;
  create(
    hotelId: string,
    actorId: string,
    input: PostCheckoutConsumptionCreate,
  ): Promise<Result>;
  act(
    hotelId: string,
    id: string,
    actorId: string,
    input: PostCheckoutConsumptionAction,
  ): Promise<Result>;
  addEvidence(
    hotelId: string,
    id: string,
    actorId: string,
    input: PostCheckoutEvidenceInput,
  ): Promise<Result>;
  pay(
    hotelId: string,
    id: string,
    actorId: string,
    input: PostCheckoutPaymentInput,
  ): Promise<Result>;
  payCorporate(
    hotelId: string,
    id: string,
    actorId: string,
    input: CorporateReceivablePaymentInput,
  ): Promise<Result>;
}

export function createPostCheckoutConsumptionRepository(): PostCheckoutConsumptionRepository {
  return {
    async departureReview(hotelId, stayId) {
      const response = await call("get_stay_departure_review", {
        p_hotel_id: hotelId,
        p_stay_id: stayId,
      });
      if (response.error) throw response.error;
      return response.data;
    },
    async list(hotelId, id) {
      const response = await call("list_post_checkout_consumption", {
        p_hotel_id: hotelId,
        p_case_id: id,
      });
      if (response.error) throw response.error;
      return response.data;
    },
    async create(hotelId, actorId, input) {
      const response = await call("create_post_checkout_consumption_case", {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_input: input,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
    async act(hotelId, id, actorId, input) {
      const response = await call("act_post_checkout_consumption_case", {
        p_hotel_id: hotelId,
        p_case_id: id,
        p_actor_id: actorId,
        p_action: input.action,
        p_expected_version: input.expected_version,
        p_reason: input.reason,
        p_result: input.result,
        p_promised_at: input.promised_at,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
    async addEvidence(hotelId, id, actorId, input) {
      const response = await call("add_post_checkout_consumption_evidence", {
        p_hotel_id: hotelId,
        p_case_id: id,
        p_actor_id: actorId,
        p_private_path: input.private_path,
        p_description: input.description,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
    async pay(hotelId, id, actorId, input) {
      const response = await call("pay_post_checkout_consumption_case", {
        p_hotel_id: hotelId,
        p_case_id: id,
        p_actor_id: actorId,
        p_expected_version: input.expected_version,
        p_tenders: input.tenders,
        p_idempotency_key: input.idempotency_key,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
    async payCorporate(hotelId, id, actorId, input) {
      const response = await call("pay_corporate_receivable", {
        p_hotel_id: hotelId,
        p_receivable_id: id,
        p_actor_id: actorId,
        p_expected_version: input.expected_version,
        p_tenders: input.tenders,
        p_idempotency_key: input.idempotency_key,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
  };
}
