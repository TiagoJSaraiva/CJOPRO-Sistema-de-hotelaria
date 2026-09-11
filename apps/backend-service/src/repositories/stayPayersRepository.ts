import type {
  CorporateAccountInput,
  CorporateCreditAction,
  CorporateCreditAuthorizationInput,
  Json,
  StayPayerAccountCreate,
  StayPayerAllocationInput,
  StayPayerPaymentInput,
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

export interface StayPayersRepository {
  list(hotelId: string, stayId: string): Promise<unknown>;
  create(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: StayPayerAccountCreate,
  ): Promise<Result>;
  allocate(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: StayPayerAllocationInput,
    simulate: boolean,
  ): Promise<Result>;
  pay(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: StayPayerPaymentInput,
  ): Promise<Result>;
  listCompanies(hotelId: string): Promise<unknown>;
  saveCompany(
    hotelId: string,
    actorId: string,
    input: CorporateAccountInput,
  ): Promise<Result>;
  requestCredit(
    hotelId: string,
    actorId: string,
    input: CorporateCreditAuthorizationInput,
  ): Promise<Result>;
  actCredit(
    hotelId: string,
    id: string,
    actorId: string,
    input: CorporateCreditAction,
  ): Promise<Result>;
}

export function createStayPayersRepository(): StayPayersRepository {
  return {
    async list(hotelId, stayId) {
      const response = await call("list_stay_payer_accounts", {
        p_hotel_id: hotelId,
        p_stay_id: stayId,
      });
      if (response.error) throw response.error;
      return response.data;
    },
    async create(hotelId, stayId, actorId, input) {
      const response = await call("create_stay_payer_account", {
        p_hotel_id: hotelId,
        p_stay_id: stayId,
        p_actor_id: actorId,
        p_kind: input.kind,
        p_customer_id: input.customer_id,
        p_corporate_id: input.corporate_account_id,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
    async allocate(hotelId, stayId, actorId, input, simulate) {
      const response = await call("assign_stay_payer_allocations", {
        p_hotel_id: hotelId,
        p_stay_id: stayId,
        p_actor_id: actorId,
        p_expected_version: input.expected_account_version,
        p_allocations: input.allocations,
        p_simulate: simulate,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
    async pay(hotelId, stayId, actorId, input) {
      const response = await call("create_stay_payer_payment", {
        p_hotel_id: hotelId,
        p_stay_id: stayId,
        p_actor_id: actorId,
        p_payer_id: input.payer_account_id,
        p_expected_version: input.expected_account_version,
        p_tenders: input.tenders,
        p_idempotency_key: input.idempotency_key,
        p_note: input.note,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
    async listCompanies(hotelId) {
      const response = await call("list_corporate_accounts", {
        p_hotel_id: hotelId,
      });
      if (response.error) throw response.error;
      return response.data;
    },
    async saveCompany(hotelId, actorId, input) {
      const response = await call("save_corporate_account", {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_id: null,
        p_input: input,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
    async requestCredit(hotelId, actorId, input) {
      const response = await call("create_corporate_credit_authorization", {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_input: input,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
    async actCredit(hotelId, id, actorId, input) {
      const response = await call("act_corporate_credit_authorization", {
        p_hotel_id: hotelId,
        p_id: id,
        p_actor_id: actorId,
        p_action: input.action,
        p_expected_version: input.expected_version,
        p_reason: input.reason,
      });
      if (response.error) throw response.error;
      return object(response.data);
    },
  };
}
