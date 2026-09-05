import type {
  AdminConsumptionCorrection,
  AdminConsumptionCorrectionCreateInput,
  AdminConsumptionCorrectionDecisionInput,
  AdminPartnerRefundConfirmationInput,
  AdminStayAccount,
  AdminStayCheckoutInput,
  AdminStayCheckoutRecord,
  AdminStayPaymentBatchInput,
  AdminStayRefundInput,
  Json,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";
import { createConsumptionOrdersRepository } from "./consumptionOrdersRepository";
import { createMaintenanceFinanceRepository } from "./maintenanceFinanceRepository";

export type AccountMutationResult =
  | { result: "ok"; item: AdminStayAccount; created?: boolean }
  | { result: string; amount?: number; balance?: number };

export type CorrectionMutationResult =
  { result: "ok"; item: AdminConsumptionCorrection } | { result: string };

export type PaymentBatchPreview = {
  currency: string;
  balance: number;
  total: number;
  remaining: number;
  allocations: Array<{ debit_entry_id: string; amount: number }>;
};

function money(value: unknown): number {
  return Number(Number(value || 0).toFixed(2));
}

function object(value: Json | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export interface StayAccountsRepository {
  getAccount(
    hotelId: string,
    stayId: string,
    includeCommercialTerms: boolean,
  ): Promise<AdminStayAccount | null>;
  previewPaymentBatch(
    hotelId: string,
    stayId: string,
    input: AdminStayPaymentBatchInput,
  ): Promise<PaymentBatchPreview | null>;
  createPaymentBatch(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: AdminStayPaymentBatchInput,
    includeCommercialTerms: boolean,
  ): Promise<AccountMutationResult>;
  requestCorrection(
    hotelId: string,
    orderId: string,
    actorId: string,
    input: AdminConsumptionCorrectionCreateInput,
  ): Promise<CorrectionMutationResult>;
  decideCorrection(
    hotelId: string,
    correctionId: string,
    actorId: string,
    input: AdminConsumptionCorrectionDecisionInput,
  ): Promise<CorrectionMutationResult>;
  confirmPartnerRefund(
    hotelId: string,
    correctionId: string,
    actorId: string,
    input: AdminPartnerRefundConfirmationInput,
  ): Promise<CorrectionMutationResult>;
  createRefund(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: AdminStayRefundInput,
    includeCommercialTerms: boolean,
  ): Promise<AccountMutationResult>;
  checkout(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: AdminStayCheckoutInput,
    includeCommercialTerms: boolean,
  ): Promise<AccountMutationResult>;
  listCorrections(
    hotelId: string,
    filters: { status?: string; stayId?: string },
  ): Promise<AdminConsumptionCorrection[]>;
  getCorrection(
    hotelId: string,
    correctionId: string,
  ): Promise<AdminConsumptionCorrection | null>;
  getCheckoutRecord(
    hotelId: string,
    stayId: string,
  ): Promise<AdminStayCheckoutRecord | null>;
}

class SupabaseStayAccountsRepository implements StayAccountsRepository {
  private async corrections(
    hotelId: string,
    filters: { id?: string; stayId?: string; status?: string },
  ): Promise<AdminConsumptionCorrection[]> {
    const supabase = createServerClient();
    let query = supabase
      .from("consumption_corrections")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("requested_at", { ascending: false });
    if (filters.id) query = query.eq("id", filters.id);
    if (filters.stayId) query = query.eq("stay_id", filters.stayId);
    if (filters.status)
      query = query.eq(
        "status",
        filters.status as AdminConsumptionCorrection["status"],
      );
    const { data, error } = await query;
    if (error) throw error;
    const ids = (data || []).map((row) => row.id);
    const { data: itemRows, error: itemError } = ids.length
      ? await supabase
          .from("consumption_correction_items")
          .select("*")
          .eq("hotel_id", hotelId)
          .in("correction_id", ids)
      : { data: [], error: null };
    if (itemError) throw itemError;
    const { data: creditRows, error: creditError } = ids.length
      ? await supabase
          .from("stay_folio_entries")
          .select("id,amount,consumption_correction_id")
          .eq("hotel_id", hotelId)
          .eq("direction", "credit")
          .eq("kind", "adjustment")
          .in("consumption_correction_id", ids)
      : { data: [], error: null };
    if (creditError) throw creditError;
    const creditIds = (creditRows || []).map((entry) => entry.id);
    const { data: allocationRows, error: allocationError } = creditIds.length
      ? await supabase
          .from("stay_folio_allocations")
          .select("credit_entry_id,amount")
          .in("credit_entry_id", creditIds)
      : { data: [], error: null };
    if (allocationError) throw allocationError;
    return (data || []).map((row) => ({
      id: row.id,
      hotel_id: row.hotel_id,
      order_id: row.order_id,
      stay_id: row.stay_id,
      kind: row.kind,
      status: row.status,
      reason: row.reason,
      account_version: Number(row.account_version),
      gross_reduction: money(row.gross_reduction),
      discount_increase: money(row.discount_increase),
      net_reduction: money(row.net_reduction),
      refundable_amount: money(
        (creditRows || [])
          .filter((entry) => entry.consumption_correction_id === row.id)
          .reduce(
            (total, entry) =>
              total +
              Number(entry.amount) -
              (allocationRows || [])
                .filter((allocation) => allocation.credit_entry_id === entry.id)
                .reduce(
                  (allocated, allocation) =>
                    allocated + Number(allocation.amount),
                  0,
                ),
            0,
          ),
      ),
      requested_by: row.requested_by,
      requested_by_name: null,
      requested_at: row.requested_at,
      decided_by: row.decided_by,
      decided_by_name: null,
      decided_at: row.decided_at,
      decision_reason: row.decision_reason,
      completed_at: row.completed_at,
      items: (itemRows || [])
        .filter((item) => item.correction_id === row.id)
        .map((item) => ({
          id: item.id,
          order_item_id: item.order_item_id,
          resulting_quantity: Number(item.resulting_quantity),
          additional_discount: money(item.additional_discount),
          previous_quantity: Number(item.previous_quantity),
          previous_discount: money(item.previous_discount),
          previous_net: money(item.previous_net),
          resulting_net: money(item.resulting_net),
          restock_quantity: Number(item.restock_quantity),
          restock_location_id: item.restock_location_id,
          inventory_version: item.inventory_version,
        })),
    }));
  }

  async getCheckoutRecord(hotelId: string, stayId: string) {
    const { data, error } = await createServerClient()
      .from("stay_checkout_records")
      .select("*")
      .eq("hotel_id", hotelId)
      .eq("stay_id", stayId)
      .order("checked_out_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data
      ? {
          id: data.id,
          kind: data.kind,
          account_version: Number(data.account_version),
          currency: data.currency,
          lodging_total: money(data.lodging_total),
          consumption_total: money(data.consumption_total),
          maintenance_total: money(data.maintenance_total),
          payment_total: money(data.payment_total),
          partner_direct_total: money(data.partner_direct_total),
          courtesy_total: money(data.courtesy_total),
          discount_total: money(data.discount_total),
          voided_total: money(data.voided_total),
          exception_folio_entry_ids: data.exception_folio_entry_ids || [],
          statement_snapshot: object(data.statement_snapshot),
          checked_out_by: data.checked_out_by,
          checked_out_at: data.checked_out_at,
        }
      : null;
  }

  async getAccount(
    hotelId: string,
    stayId: string,
    includeCommercialTerms: boolean,
  ) {
    const supabase = createServerClient();
    const { data: stay, error: stayError } = await supabase
      .from("stays")
      .select(
        "id,reservation_id,stay_status,account_version,reservation:reservation_id(id,hotel_id,reservation_code,customer:booking_customer_id(full_name)),room:room_id(room_number)",
      )
      .eq("id", stayId)
      .maybeSingle();
    if (stayError) throw stayError;
    if (!stay || stay.reservation?.hotel_id !== hotelId) return null;
    const folio = await createMaintenanceFinanceRepository().getStayFolio(
      hotelId,
      stayId,
    );
    if (!folio) return null;
    const [
      orderRows,
      corrections,
      batchesResult,
      tendersResult,
      refundsResult,
      checkoutRecord,
    ] = await Promise.all([
      supabase
        .from("consumption_orders")
        .select("id")
        .eq("hotel_id", hotelId)
        .eq("stay_id", stayId)
        .order("occurred_at", { ascending: false }),
      this.corrections(hotelId, { stayId }),
      supabase
        .from("stay_payment_batches")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("stay_id", stayId)
        .order("created_at", { ascending: false }),
      supabase
        .from("stay_payment_batch_tenders")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("display_order"),
      supabase
        .from("stay_refunds")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("stay_id", stayId)
        .order("created_at", { ascending: false }),
      this.getCheckoutRecord(hotelId, stayId),
    ]);
    for (const result of [
      orderRows,
      batchesResult,
      tendersResult,
      refundsResult,
    ])
      if (result.error) throw result.error;
    const orderRepository = createConsumptionOrdersRepository();
    const orders = (
      await Promise.all(
        (orderRows.data || []).map((row) =>
          orderRepository.get(hotelId, row.id, includeCommercialTerms),
        ),
      )
    ).filter((order): order is NonNullable<typeof order> => Boolean(order));
    const lodgingTotal = money(
      folio.entries
        .filter(
          (entry) => entry.direction === "debit" && entry.kind === "lodging",
        )
        .reduce((sum, entry) => sum + entry.amount, 0),
    );
    const consumptionTotal = money(
      folio.entries
        .filter(
          (entry) =>
            entry.direction === "debit" && entry.kind === "consumption_charge",
        )
        .reduce((sum, entry) => sum + entry.amount, 0),
    );
    const maintenanceTotal = money(
      folio.entries
        .filter(
          (entry) =>
            entry.direction === "debit" && entry.kind === "maintenance_charge",
        )
        .reduce((sum, entry) => sum + entry.amount, 0),
    );
    const checkoutBalance = money(
      folio.entries
        .filter(
          (entry) =>
            entry.direction === "debit" &&
            entry.kind !== "maintenance_charge" &&
            entry.open_amount > 0,
        )
        .reduce((sum, entry) => sum + entry.open_amount, 0),
    );
    const refundableCredit = money(
      folio.entries
        .filter(
          (entry) => entry.direction === "credit" && entry.open_amount > 0,
        )
        .reduce((sum, entry) => sum + entry.open_amount, 0),
    );
    Object.assign(folio, {
      lodging_total: lodgingTotal,
      consumption_total: consumptionTotal,
      maintenance_total: maintenanceTotal,
      available_credit: refundableCredit,
      checkout_balance: checkoutBalance,
      refundable_credit: refundableCredit,
    });
    const pendingCorrection = corrections.some((item) =>
      [
        "pending",
        "approved",
        "awaiting_refund",
        "awaiting_partner_refund",
      ].includes(item.status),
    );
    const status: AdminStayAccount["status"] =
      stay.stay_status === "checked_out"
        ? refundableCredit > 0
          ? "closed_with_pending_refund"
          : checkoutRecord?.exception_folio_entry_ids.length
            ? "closed_with_exception"
            : "closed"
        : checkoutBalance === 0 && refundableCredit === 0 && !pendingCorrection
          ? "ready_to_checkout"
          : "open";
    const batchIds = (batchesResult.data || []).map((batch) => batch.id);
    return {
      stay_id: stay.id,
      reservation_id: stay.reservation_id,
      reservation_code: stay.reservation?.reservation_code || null,
      room_number: stay.room?.room_number || "—",
      guest_name: stay.reservation?.customer?.full_name || null,
      stay_status: stay.stay_status || "confirmed",
      currency: folio.currency,
      version: Number(stay.account_version),
      status,
      folio,
      consumption_orders: orders,
      corrections,
      payment_batches: (batchesResult.data || []).map((batch) => ({
        id: batch.id,
        kind: batch.kind,
        amount: money(batch.amount),
        currency: batch.currency,
        note: batch.note,
        created_by: batch.created_by,
        created_at: batch.created_at,
        tenders: (tendersResult.data || [])
          .filter(
            (tender) =>
              batchIds.includes(tender.batch_id) &&
              tender.batch_id === batch.id,
          )
          .map((tender) => ({
            id: tender.id,
            payment_method: tender.payment_method,
            amount: money(tender.amount),
            reference_code: tender.reference_code,
            financial_transaction_id: tender.financial_transaction_id,
            folio_credit_entry_id: tender.folio_credit_entry_id,
            display_order: tender.display_order,
          })),
      })),
      refunds: (refundsResult.data || []).map((refund) => ({
        id: refund.id,
        amount: money(refund.amount),
        currency: refund.currency,
        payment_method: refund.payment_method,
        original_payment_method: refund.original_payment_method,
        method_override_reason: refund.method_override_reason,
        reference_code: refund.reference_code,
        reason: refund.reason,
        correction_id: refund.correction_id,
        created_by: refund.created_by,
        created_at: refund.created_at,
      })),
      checkout_record: checkoutRecord,
    } satisfies AdminStayAccount;
  }

  async previewPaymentBatch(
    hotelId: string,
    stayId: string,
    input: AdminStayPaymentBatchInput,
  ) {
    const account = await this.getAccount(hotelId, stayId, false);
    if (!account) return null;
    const total = money(
      input.tenders.reduce((sum, item) => sum + item.amount, 0),
    );
    let remainingToAllocate = total;
    const allocations: PaymentBatchPreview["allocations"] = [];
    for (const entry of account.folio.entries) {
      if (
        entry.direction !== "debit" ||
        entry.kind === "maintenance_charge" ||
        entry.open_amount <= 0 ||
        remainingToAllocate <= 0
      )
        continue;
      const amount = money(Math.min(entry.open_amount, remainingToAllocate));
      allocations.push({ debit_entry_id: entry.id, amount });
      remainingToAllocate = money(remainingToAllocate - amount);
    }
    return {
      currency: account.currency,
      balance: account.folio.checkout_balance || 0,
      total,
      remaining: money((account.folio.checkout_balance || 0) - total),
      allocations,
    };
  }

  private async accountAfterRpc(
    data: Json | null,
    hotelId: string,
    stayId: string,
    includeTerms: boolean,
  ): Promise<AccountMutationResult> {
    const payload = object(data);
    if (payload.result !== "ok")
      return {
        result: String(payload.result || "conflict"),
        amount: payload.amount == null ? undefined : money(payload.amount),
        balance: payload.balance == null ? undefined : money(payload.balance),
      };
    const item = await this.getAccount(hotelId, stayId, includeTerms);
    return item
      ? { result: "ok", item, created: payload.created !== false }
      : { result: "not_found" };
  }

  async createPaymentBatch(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: AdminStayPaymentBatchInput,
    includeTerms: boolean,
  ) {
    const { data, error } = await createServerClient().rpc(
      "create_stay_payment_batch",
      {
        p_hotel_id: hotelId,
        p_stay_id: stayId,
        p_actor_id: actorId,
        p_tenders: input.tenders as unknown as Json,
        p_idempotency_key: input.idempotency_key,
        p_expected_version: input.expected_version,
        p_kind: "regular",
        p_note: input.note || undefined,
      },
    );
    if (error) throw error;
    return this.accountAfterRpc(data, hotelId, stayId, includeTerms);
  }

  async requestCorrection(
    hotelId: string,
    orderId: string,
    actorId: string,
    input: AdminConsumptionCorrectionCreateInput,
  ) {
    const { data, error } = await createServerClient().rpc(
      "request_consumption_correction_with_inventory",
      {
        p_hotel_id: hotelId,
        p_order_id: orderId,
        p_actor_id: actorId,
        p_kind: input.kind,
        p_reason: input.reason,
        p_items: (input.items || []) as unknown as Json,
        p_expected_version: input.expected_version,
      },
    );
    if (error) {
      if (error.code === "23514") {
        const reason = [
          "invalid_restock",
          "return_location_unavailable",
          "inventory_version_conflict",
        ].find((candidate) => error.message.includes(candidate));
        return { result: reason || "invalid_correction" };
      }
      throw error;
    }
    const payload = object(data);
    if (payload.result !== "ok")
      return { result: String(payload.result || "conflict") };
    const item = await this.getCorrection(
      hotelId,
      String(payload.correction_id),
    );
    return item ? { result: "ok" as const, item } : { result: "not_found" };
  }

  async decideCorrection(
    hotelId: string,
    correctionId: string,
    actorId: string,
    input: AdminConsumptionCorrectionDecisionInput,
  ) {
    const { data, error } = await createServerClient().rpc(
      "decide_consumption_correction_with_inventory",
      {
        p_hotel_id: hotelId,
        p_correction_id: correctionId,
        p_actor_id: actorId,
        p_decision: input.decision,
        p_reason: input.reason || undefined,
      },
    );
    if (error) throw error;
    const payload = object(data);
    if (payload.result !== "ok")
      return { result: String(payload.result || "conflict") };
    const item = await this.getCorrection(hotelId, correctionId);
    return item ? { result: "ok" as const, item } : { result: "not_found" };
  }

  async confirmPartnerRefund(
    hotelId: string,
    correctionId: string,
    actorId: string,
    input: AdminPartnerRefundConfirmationInput,
  ) {
    const { data, error } = await createServerClient().rpc(
      "complete_partner_correction_refund",
      {
        p_hotel_id: hotelId,
        p_correction_id: correctionId,
        p_actor_id: actorId,
        p_reference: input.reference_code || undefined,
      },
    );
    if (error) throw error;
    const payload = object(data);
    if (payload.result !== "ok")
      return { result: String(payload.result || "conflict") };
    const item = await this.getCorrection(hotelId, correctionId);
    return item ? { result: "ok" as const, item } : { result: "not_found" };
  }

  async createRefund(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: AdminStayRefundInput,
    includeTerms: boolean,
  ) {
    const { data, error } = await createServerClient().rpc(
      "create_stay_refund",
      {
        p_hotel_id: hotelId,
        p_stay_id: stayId,
        p_actor_id: actorId,
        p_amount: input.amount,
        p_payment_method: input.payment_method,
        p_reason: input.reason,
        p_idempotency_key: input.idempotency_key,
        p_expected_version: input.expected_version,
        p_correction_id: input.correction_id || undefined,
        p_original_tender_id: input.original_tender_id || undefined,
        p_reference: input.reference_code || undefined,
        p_method_override_reason: input.method_override_reason || undefined,
      },
    );
    if (error) throw error;
    return this.accountAfterRpc(data, hotelId, stayId, includeTerms);
  }

  async checkout(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: AdminStayCheckoutInput,
    includeTerms: boolean,
  ) {
    const { data, error } = await createServerClient().rpc(
      "checkout_stay_account",
      {
        p_hotel_id: hotelId,
        p_stay_id: stayId,
        p_actor_id: actorId,
        p_expected_version: input.expected_version,
        p_tenders: input.tenders as unknown as Json,
        p_idempotency_key: input.idempotency_key,
        p_occurrence_ids: input.maintenance_acknowledged_occurrence_ids || [],
        p_maintenance_folio_entry_ids:
          input.maintenance_acknowledged_folio_entry_ids || [],
        p_note: input.maintenance_acknowledgement_note || undefined,
      },
    );
    if (error) throw error;
    return this.accountAfterRpc(data, hotelId, stayId, includeTerms);
  }

  listCorrections(
    hotelId: string,
    filters: { status?: string; stayId?: string },
  ) {
    return this.corrections(hotelId, filters);
  }

  async getCorrection(hotelId: string, correctionId: string) {
    return (await this.corrections(hotelId, { id: correctionId }))[0] || null;
  }
}

export function createStayAccountsRepository(): StayAccountsRepository {
  return new SupabaseStayAccountsRepository();
}
