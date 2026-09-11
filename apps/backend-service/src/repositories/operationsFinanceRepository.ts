import type {
  CashMovementInput,
  CashRegisterInput,
  CashSessionAction,
  CashSessionOpen,
  DailyCloseAction,
  DailyClosePrepare,
  LotAction,
  LotTrackingInput,
  MinibarCompositionInput,
  MinibarCompositionVersionInput,
  MinibarRouteInput,
  OrganizationAction,
  OrganizationInput,
  PartnerDisputeInput,
  PaymentInput,
  ProcurementInvoiceInput,
  ProcurementPolicyInput,
  PurchaseOrderInput,
  PurchaseReceiptInput,
  ReplenishmentAction,
  ReplenishmentRequestInput,
  VersionedReasonAction,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

type Result = { result: string; id?: string; context?: unknown };
type RpcClient = {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: Error | null }>;
};
const object = (value: unknown): Result =>
  value && typeof value === "object"
    ? (value as Result)
    : { result: "invalid_response" };

export interface OperationsFinanceRepository {
  rpc(name: string, args?: Record<string, unknown>): Promise<unknown>;
  mutation(name: string, args?: Record<string, unknown>): Promise<Result>;
}

export function createOperationsFinanceRepository(
  client?: RpcClient,
): OperationsFinanceRepository {
  const rpcClient = (): RpcClient =>
    client ?? (createServerClient() as unknown as RpcClient);
  return {
    async rpc(name, args = {}) {
      const response = await rpcClient().rpc(name, args);
      if (response.error) throw response.error;
      return response.data;
    },
    async mutation(name, args = {}) {
      const response = await rpcClient().rpc(name, args);
      if (response.error) throw response.error;
      return object(response.data);
    },
  };
}

export type OperationsInput =
  | OrganizationInput
  | OrganizationAction
  | ProcurementPolicyInput
  | ReplenishmentRequestInput
  | ReplenishmentAction
  | PurchaseOrderInput
  | VersionedReasonAction
  | PurchaseReceiptInput
  | ProcurementInvoiceInput
  | PaymentInput
  | LotTrackingInput
  | LotAction
  | MinibarCompositionInput
  | MinibarCompositionVersionInput
  | MinibarRouteInput
  | CashRegisterInput
  | CashSessionOpen
  | CashSessionAction
  | CashMovementInput
  | DailyClosePrepare
  | DailyCloseAction
  | PartnerDisputeInput;
