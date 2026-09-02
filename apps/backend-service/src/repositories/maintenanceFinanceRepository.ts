import type {
  AdminMaintenanceCostItem,
  AdminMaintenanceCostItemInput,
  AdminMaintenanceFinanceListResponse,
  AdminMaintenanceFinanceOccurrence,
  AdminMaintenanceFinanceSummary,
  AdminMaintenanceFinancialAttachment,
  AdminMaintenanceRecovery,
  AdminMaintenanceRecoveryInput,
  AdminStayFolioAllocationPreview,
  AdminStayFolioResponse,
  AdminStayPaymentCreateInput,
  Json,
  Tables,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

type WriteResult<T> =
  { result: "ok"; item: T } | { result: "not-found" | "conflict" };

type CostRow = Tables<"maintenance_cost_items"> & {
  proposer?: { name: string } | null;
  occurrence?: { occurrence_number: number } | null;
};
type RecoveryRow = Tables<"maintenance_recoveries"> & {
  proposer?: { name: string } | null;
  occurrence?: { occurrence_number: number } | null;
};

const costSelect =
  "*,proposer:created_by(name),occurrence:occurrence_id(occurrence_number)";
const recoverySelect =
  "*,proposer:created_by(name),occurrence:occurrence_id(occurrence_number)";

function money(value: unknown): number {
  return Number(Number(value || 0).toFixed(2));
}

function occurrenceCode(row: {
  occurrence?: { occurrence_number: number } | null;
}) {
  return row.occurrence
    ? `MAN-${String(row.occurrence.occurrence_number).padStart(6, "0")}`
    : undefined;
}

export interface MaintenanceFinanceRepository {
  getStayFolio(
    hotelId: string,
    stayId: string,
  ): Promise<AdminStayFolioResponse | null>;
  previewStayAllocation(
    hotelId: string,
    stayId: string,
    amount: number,
  ): Promise<AdminStayFolioAllocationPreview | null>;
  createStayPayment(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: AdminStayPaymentCreateInput,
  ): Promise<WriteResult<AdminStayFolioResponse>>;
  getOccurrenceFinance(
    hotelId: string,
    occurrenceId: string,
  ): Promise<AdminMaintenanceFinanceOccurrence | null>;
  getSummary(hotelId: string): Promise<AdminMaintenanceFinanceSummary>;
  listItems(
    hotelId: string,
    filters: {
      page: number;
      pageSize: number;
      queue?: string;
      kind?: string;
      occurrenceId?: string;
    },
  ): Promise<AdminMaintenanceFinanceListResponse>;
  createCostItem(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    input: AdminMaintenanceCostItemInput,
  ): Promise<WriteResult<AdminMaintenanceCostItem>>;
  updateCostItem(
    hotelId: string,
    id: string,
    actorId: string,
    input: AdminMaintenanceCostItemInput,
  ): Promise<WriteResult<AdminMaintenanceCostItem>>;
  transitionCostItem(
    hotelId: string,
    id: string,
    actorId: string,
    action: string,
    reason?: string,
  ): Promise<WriteResult<AdminMaintenanceCostItem>>;
  settleCostItem(
    hotelId: string,
    id: string,
    actorId: string,
    input: {
      amount: number;
      method: string;
      settled_at?: string;
      reference_code?: string;
      note?: string;
    },
  ): Promise<WriteResult<AdminMaintenanceCostItem>>;
  createRecovery(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    input: AdminMaintenanceRecoveryInput,
  ): Promise<WriteResult<AdminMaintenanceRecovery>>;
  updateRecovery(
    hotelId: string,
    id: string,
    actorId: string,
    input: AdminMaintenanceRecoveryInput,
  ): Promise<WriteResult<AdminMaintenanceRecovery>>;
  transitionRecovery(
    hotelId: string,
    id: string,
    actorId: string,
    action: string,
    reason?: string,
  ): Promise<WriteResult<AdminMaintenanceRecovery>>;
  settleRecovery(
    hotelId: string,
    id: string,
    actorId: string,
    input: {
      amount: number;
      method: string;
      settled_at?: string;
      reference_code?: string;
      note?: string;
      allocations?: Array<{ debit_entry_id: string; amount: number }>;
    },
  ): Promise<WriteResult<AdminMaintenanceRecovery>>;
  reverseSettlement(
    hotelId: string,
    id: string,
    actorId: string,
    reason: string,
  ): Promise<WriteResult<AdminMaintenanceFinanceOccurrence>>;
  countAttachments(hotelId: string, occurrenceId: string): Promise<number>;
  createUploadIntent(
    hotelId: string,
    occurrenceId: string,
    filename: string,
  ): Promise<{
    storage_path: string;
    token: string;
    signed_url: string;
  }>;
  finalizeAttachments(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    targetType: "cost_item" | "recovery",
    targetId: string,
    files: Array<Record<string, unknown>>,
  ): Promise<WriteResult<AdminMaintenanceFinanceOccurrence>>;
  createAttachmentAccess(
    hotelId: string,
    id: string,
  ): Promise<{ signed_url: string; expires_in: number } | null>;
  removeAttachment(
    hotelId: string,
    id: string,
    actorId: string,
    reason: string,
  ): Promise<WriteResult<AdminMaintenanceFinanceOccurrence>>;
}

class SupabaseMaintenanceFinanceRepository implements MaintenanceFinanceRepository {
  private async currency(hotelId: string): Promise<string> {
    const { data, error } = await createServerClient()
      .from("hotels")
      .select("currency")
      .eq("id", hotelId)
      .single();
    if (error || !data) throw error || new Error("Hotel not found");
    return String(data.currency || "BRL").toUpperCase();
  }

  async getStayFolio(
    hotelId: string,
    stayId: string,
  ): Promise<AdminStayFolioResponse | null> {
    const supabase = createServerClient();
    const stay = await supabase
      .from("stays")
      .select("id,reservation:reservation_id(hotel_id)")
      .eq("id", stayId)
      .maybeSingle();
    if (stay.error) throw stay.error;
    if (!stay.data || stay.data.reservation?.hotel_id !== hotelId) return null;
    const [entriesResult, allocationsResult] = await Promise.all([
      supabase
        .from("stay_folio_entries")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("stay_id", stayId)
        .order("posted_at", { ascending: true }),
      supabase
        .from("stay_folio_allocations")
        .select("id,credit_entry_id,debit_entry_id,amount,created_at")
        .eq("hotel_id", hotelId)
        .eq("stay_id", stayId),
    ]);
    if (entriesResult.error || allocationsResult.error)
      throw entriesResult.error || allocationsResult.error;
    const allocations = allocationsResult.data || [];
    const allocated = new Map<string, number>();
    for (const allocation of allocations) {
      allocated.set(
        allocation.debit_entry_id,
        money(
          (allocated.get(allocation.debit_entry_id) || 0) +
            Number(allocation.amount),
        ),
      );
      allocated.set(
        allocation.credit_entry_id,
        money(
          (allocated.get(allocation.credit_entry_id) || 0) +
            Number(allocation.amount),
        ),
      );
    }
    const entries = (entriesResult.data || []).map((entry) => {
      const allocatedAmount = allocated.get(entry.id) || 0;
      return {
        id: entry.id,
        stay_id: entry.stay_id,
        reservation_id: entry.reservation_id,
        direction: entry.direction,
        kind: entry.kind,
        amount: money(entry.amount),
        currency: entry.currency,
        description: entry.description,
        maintenance_occurrence_id: entry.maintenance_occurrence_id,
        financial_transaction_id: entry.financial_transaction_id,
        reversed_entry_id: entry.reversed_entry_id,
        allocated_amount: allocatedAmount,
        open_amount: money(Number(entry.amount) - allocatedAmount),
        posted_at: entry.posted_at,
      };
    });
    const totalDebits = money(
      entries
        .filter((entry) => entry.direction === "debit")
        .reduce((sum, entry) => sum + entry.amount, 0),
    );
    const totalCredits = money(
      entries
        .filter((entry) => entry.direction === "credit")
        .reduce((sum, entry) => sum + entry.amount, 0),
    );
    const balance = money(totalDebits - totalCredits);
    return {
      stay_id: stayId,
      currency: entries[0]?.currency || (await this.currency(hotelId)),
      entries,
      allocations: allocations.map((allocation) => ({
        ...allocation,
        amount: money(allocation.amount),
      })),
      total_debits: totalDebits,
      total_credits: totalCredits,
      balance,
      payment_status:
        totalCredits <= 0 ? "pending" : balance > 0 ? "partial" : "paid",
      pending_maintenance_entry_ids: entries
        .filter(
          (entry) =>
            entry.kind === "maintenance_charge" &&
            entry.direction === "debit" &&
            entry.open_amount > 0,
        )
        .map((entry) => entry.id),
    };
  }

  async previewStayAllocation(hotelId: string, stayId: string, amount: number) {
    const folio = await this.getStayFolio(hotelId, stayId);
    if (!folio) return null;
    let remaining = money(amount);
    const allocations: Array<{ debit_entry_id: string; amount: number }> = [];
    for (const entry of folio.entries) {
      if (
        entry.direction !== "debit" ||
        entry.open_amount <= 0 ||
        remaining <= 0
      )
        continue;
      const allocatedAmount = money(Math.min(entry.open_amount, remaining));
      allocations.push({ debit_entry_id: entry.id, amount: allocatedAmount });
      remaining = money(remaining - allocatedAmount);
    }
    return {
      amount: money(amount),
      allocations,
      unallocated_amount: remaining,
    };
  }

  async createStayPayment(
    hotelId: string,
    stayId: string,
    actorId: string,
    input: AdminStayPaymentCreateInput,
  ): Promise<WriteResult<AdminStayFolioResponse>> {
    const { data, error } = await createServerClient().rpc(
      "create_stay_folio_payment",
      {
        p_hotel_id: hotelId,
        p_stay_id: stayId,
        p_actor_id: actorId,
        p_amount: input.amount,
        p_method: input.method,
        p_note: input.note || undefined,
        p_paid_at: input.paid_at || undefined,
        p_allocations: (input.allocations || null) as Json,
      },
    );
    if (error) return { result: "conflict" };
    if (!data) return { result: "not-found" };
    const item = await this.getStayFolio(hotelId, stayId);
    return item ? { result: "ok", item } : { result: "not-found" };
  }

  private async mapCost(
    row: CostRow,
    detailed = false,
  ): Promise<AdminMaintenanceCostItem> {
    const supabase = createServerClient();
    const settlementsResult = await supabase
      .from("maintenance_financial_settlements")
      .select(
        "id,cost_item_id,recovery_id,financial_transaction_id,amount,created_by,created_at,reversal_of_id",
      )
      .eq("cost_item_id", row.id);
    if (settlementsResult.error) throw settlementsResult.error;
    const settlements = settlementsResult.data || [];
    const settled = money(
      settlements.reduce(
        (sum, item) =>
          sum +
          (item.reversal_of_id ? -Number(item.amount) : Number(item.amount)),
        0,
      ),
    );
    let attachments: AdminMaintenanceCostItem["attachments"];
    if (detailed) {
      const result = await supabase
        .from("maintenance_financial_attachments")
        .select(
          "id,occurrence_id,cost_item_id,recovery_id,original_filename,content_type,size_bytes,uploaded_by,created_at,removed_at",
        )
        .eq("cost_item_id", row.id);
      if (result.error) throw result.error;
      attachments = (result.data || []).map((item) => ({
        ...item,
        content_type:
          item.content_type as AdminMaintenanceFinancialAttachment["content_type"],
        size_bytes: Number(item.size_bytes),
      }));
    }
    return {
      id: row.id,
      occurrence_id: row.occurrence_id,
      occurrence_code: occurrenceCode(row),
      work_order_id: row.work_order_id,
      kind: row.kind,
      description: row.description,
      quantity: Number(row.quantity),
      estimated_amount:
        row.estimated_amount == null ? null : money(row.estimated_amount),
      actual_amount:
        row.actual_amount == null ? null : money(row.actual_amount),
      currency: row.currency,
      counterparty: row.counterparty,
      supplier_id: row.supplier_id,
      contract_id: row.contract_id,
      due_date: row.due_date,
      reference_code: row.reference_code,
      approval_status: row.approval_status,
      settlement_status: row.settlement_status,
      created_by: row.created_by,
      proposer_name: row.proposer?.name,
      submitted_at: row.submitted_at,
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      decision_reason: row.decision_reason,
      settled_amount: settled,
      outstanding_amount: money(
        Math.max(0, Number(row.actual_amount || 0) - settled),
      ),
      settlements: settlements.map((item) => ({
        ...item,
        amount: money(item.amount),
      })),
      attachments,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private async mapRecovery(
    row: RecoveryRow,
    detailed = false,
  ): Promise<AdminMaintenanceRecovery> {
    const supabase = createServerClient();
    const settlementsResult = await supabase
      .from("maintenance_financial_settlements")
      .select(
        "id,cost_item_id,recovery_id,financial_transaction_id,amount,created_by,created_at,reversal_of_id",
      )
      .eq("recovery_id", row.id);
    if (settlementsResult.error) throw settlementsResult.error;
    const settlements = settlementsResult.data || [];
    const settled = money(
      settlements.reduce(
        (sum, item) =>
          sum +
          (item.reversal_of_id ? -Number(item.amount) : Number(item.amount)),
        0,
      ),
    );
    let attachments: AdminMaintenanceRecovery["attachments"];
    if (detailed) {
      const result = await supabase
        .from("maintenance_financial_attachments")
        .select(
          "id,occurrence_id,cost_item_id,recovery_id,original_filename,content_type,size_bytes,uploaded_by,created_at,removed_at",
        )
        .eq("recovery_id", row.id);
      if (result.error) throw result.error;
      attachments = (result.data || []).map((item) => ({
        ...item,
        content_type:
          item.content_type as AdminMaintenanceFinancialAttachment["content_type"],
        size_bytes: Number(item.size_bytes),
      }));
    }
    return {
      id: row.id,
      occurrence_id: row.occurrence_id,
      occurrence_code: occurrenceCode(row),
      responsible_party: row.responsible_party as "guest" | "supplier",
      stay_id: row.stay_id,
      debtor_name: row.debtor_name,
      supplier_id: row.supplier_id,
      contract_id: row.contract_id,
      charge_amount: money(row.charge_amount),
      waived_amount: money(row.waived_amount),
      currency: row.currency,
      justification: row.justification,
      due_date: row.due_date,
      approval_status: row.approval_status,
      settlement_status: row.settlement_status,
      folio_entry_id: row.folio_entry_id,
      created_by: row.created_by,
      proposer_name: row.proposer?.name,
      submitted_at: row.submitted_at,
      approved_by: row.approved_by,
      approved_at: row.approved_at,
      decision_reason: row.decision_reason,
      settled_amount: settled,
      outstanding_amount: money(
        Math.max(0, Number(row.charge_amount) - settled),
      ),
      settlements: settlements.map((item) => ({
        ...item,
        amount: money(item.amount),
      })),
      attachments,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async getOccurrenceFinance(hotelId: string, occurrenceId: string) {
    const supabase = createServerClient();
    const occurrence = await supabase
      .from("maintenance_occurrences")
      .select("id")
      .eq("hotel_id", hotelId)
      .eq("id", occurrenceId)
      .maybeSingle();
    if (occurrence.error) throw occurrence.error;
    if (!occurrence.data) return null;
    const [costsResult, recoveriesResult] = await Promise.all([
      supabase
        .from("maintenance_cost_items")
        .select(costSelect)
        .eq("hotel_id", hotelId)
        .eq("occurrence_id", occurrenceId)
        .order("created_at"),
      supabase
        .from("maintenance_recoveries")
        .select(recoverySelect)
        .eq("hotel_id", hotelId)
        .eq("occurrence_id", occurrenceId)
        .order("created_at"),
    ]);
    if (costsResult.error || recoveriesResult.error)
      throw costsResult.error || recoveriesResult.error;
    const costs = await Promise.all(
      (costsResult.data || []).map((row) => this.mapCost(row as CostRow, true)),
    );
    const recoveries = await Promise.all(
      (recoveriesResult.data || []).map((row) =>
        this.mapRecovery(row as RecoveryRow, true),
      ),
    );
    const estimated = money(
      costs.reduce((sum, item) => sum + Number(item.estimated_amount || 0), 0),
    );
    const approvedCost = money(
      costs
        .filter((item) => item.approval_status === "approved")
        .reduce((sum, item) => sum + Number(item.actual_amount || 0), 0),
    );
    const approvedRecovery = money(
      recoveries
        .filter((item) => item.approval_status === "approved")
        .reduce((sum, item) => sum + item.charge_amount, 0),
    );
    return {
      occurrence_id: occurrenceId,
      currency:
        costs[0]?.currency ||
        recoveries[0]?.currency ||
        (await this.currency(hotelId)),
      estimated_cost: estimated,
      approved_cost: approvedCost,
      settled_cost: money(
        costs.reduce((sum, item) => sum + item.settled_amount, 0),
      ),
      approved_recovery: approvedRecovery,
      received_recovery: money(
        recoveries.reduce((sum, item) => sum + item.settled_amount, 0),
      ),
      net_result: money(approvedCost - approvedRecovery),
      cost_items: costs,
      recoveries,
    };
  }

  async getSummary(hotelId: string): Promise<AdminMaintenanceFinanceSummary> {
    const listed = await this.listItems(hotelId, { page: 1, pageSize: 500 });
    const now = new Date().toISOString().slice(0, 10);
    return {
      currency: await this.currency(hotelId),
      awaiting_approval: listed.items.filter(
        (item) => item.approval_status === "submitted",
      ).length,
      payable: listed.items.filter(
        (item) =>
          "actual_amount" in item &&
          ["open", "partially_settled"].includes(item.settlement_status),
      ).length,
      receivable: listed.items.filter(
        (item) =>
          "charge_amount" in item &&
          ["open", "partially_settled"].includes(item.settlement_status),
      ).length,
      overdue: listed.items.filter(
        (item) =>
          item.due_date &&
          item.due_date < now &&
          ["open", "partially_settled"].includes(item.settlement_status),
      ).length,
      settled: listed.items.filter(
        (item) => item.settlement_status === "settled",
      ).length,
      payable_amount: money(
        listed.items
          .filter(
            (item): item is AdminMaintenanceCostItem => "actual_amount" in item,
          )
          .reduce((sum, item) => sum + item.outstanding_amount, 0),
      ),
      receivable_amount: money(
        listed.items
          .filter(
            (item): item is AdminMaintenanceRecovery => "charge_amount" in item,
          )
          .reduce((sum, item) => sum + item.outstanding_amount, 0),
      ),
    };
  }

  async listItems(
    hotelId: string,
    filters: {
      page: number;
      pageSize: number;
      queue?: string;
      kind?: string;
      occurrenceId?: string;
    },
  ) {
    const supabase = createServerClient();
    let costQuery = supabase
      .from("maintenance_cost_items")
      .select(costSelect)
      .eq("hotel_id", hotelId);
    let recoveryQuery = supabase
      .from("maintenance_recoveries")
      .select(recoverySelect)
      .eq("hotel_id", hotelId);
    if (filters.occurrenceId) {
      costQuery = costQuery.eq("occurrence_id", filters.occurrenceId);
      recoveryQuery = recoveryQuery.eq("occurrence_id", filters.occurrenceId);
    }
    if (filters.kind === "cost")
      recoveryQuery = recoveryQuery.eq(
        "id",
        "00000000-0000-0000-0000-000000000000",
      );
    if (filters.kind === "recovery")
      costQuery = costQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    const [costResult, recoveryResult] = await Promise.all([
      costQuery,
      recoveryQuery,
    ]);
    if (costResult.error || recoveryResult.error)
      throw costResult.error || recoveryResult.error;
    let items = [
      ...(await Promise.all(
        (costResult.data || []).map((row) => this.mapCost(row as CostRow)),
      )),
      ...(await Promise.all(
        (recoveryResult.data || []).map((row) =>
          this.mapRecovery(row as RecoveryRow),
        ),
      )),
    ];
    const today = new Date().toISOString().slice(0, 10);
    if (filters.queue === "approval")
      items = items.filter((item) => item.approval_status === "submitted");
    if (filters.queue === "payable")
      items = items.filter(
        (item) =>
          "actual_amount" in item &&
          ["open", "partially_settled"].includes(item.settlement_status),
      );
    if (filters.queue === "receivable")
      items = items.filter(
        (item) =>
          "charge_amount" in item &&
          ["open", "partially_settled"].includes(item.settlement_status),
      );
    if (filters.queue === "overdue")
      items = items.filter(
        (item) =>
          item.due_date &&
          item.due_date < today &&
          ["open", "partially_settled"].includes(item.settlement_status),
      );
    if (filters.queue === "settled")
      items = items.filter((item) => item.settlement_status === "settled");
    items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const total = items.length;
    const start = (filters.page - 1) * filters.pageSize;
    return {
      items: items.slice(start, start + filters.pageSize),
      page: filters.page,
      page_size: filters.pageSize,
      total,
    };
  }

  private async getCost(hotelId: string, id: string) {
    const { data, error } = await createServerClient()
      .from("maintenance_cost_items")
      .select(costSelect)
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapCost(data as CostRow, true) : null;
  }

  private async getRecovery(hotelId: string, id: string) {
    const { data, error } = await createServerClient()
      .from("maintenance_recoveries")
      .select(recoverySelect)
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? this.mapRecovery(data as RecoveryRow, true) : null;
  }

  async createCostItem(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    input: AdminMaintenanceCostItemInput,
  ) {
    const { data, error } = await createServerClient()
      .from("maintenance_cost_items")
      .insert({
        hotel_id: hotelId,
        occurrence_id: occurrenceId,
        work_order_id: input.work_order_id || null,
        kind: input.kind,
        description: input.description.trim(),
        quantity: input.quantity ?? 1,
        estimated_amount: input.estimated_amount ?? null,
        actual_amount: input.actual_amount ?? null,
        currency: await this.currency(hotelId),
        counterparty: input.counterparty?.trim() || null,
        supplier_id: input.supplier_id || null,
        contract_id: input.contract_id || null,
        due_date: input.due_date || null,
        reference_code: input.reference_code?.trim() || null,
        created_by: actorId,
      })
      .select("id")
      .single();
    if (error || !data) return { result: "conflict" as const };
    const item = await this.getCost(hotelId, data.id);
    return item
      ? { result: "ok" as const, item }
      : { result: "not-found" as const };
  }

  async updateCostItem(
    hotelId: string,
    id: string,
    actorId: string,
    input: AdminMaintenanceCostItemInput,
  ) {
    const current = await this.getCost(hotelId, id);
    if (!current) return { result: "not-found" as const };
    if (
      !["draft", "rejected"].includes(current.approval_status) ||
      current.created_by !== actorId
    )
      return { result: "conflict" as const };
    const { error } = await createServerClient()
      .from("maintenance_cost_items")
      .update({
        work_order_id: input.work_order_id || null,
        kind: input.kind,
        description: input.description.trim(),
        quantity: input.quantity ?? 1,
        estimated_amount: input.estimated_amount ?? null,
        actual_amount: input.actual_amount ?? null,
        counterparty: input.counterparty?.trim() || null,
        supplier_id: input.supplier_id || null,
        contract_id: input.contract_id || null,
        due_date: input.due_date || null,
        reference_code: input.reference_code?.trim() || null,
      })
      .eq("hotel_id", hotelId)
      .eq("id", id);
    if (error) return { result: "conflict" as const };
    return { result: "ok" as const, item: (await this.getCost(hotelId, id))! };
  }

  async transitionCostItem(
    hotelId: string,
    id: string,
    actorId: string,
    action: string,
    reason?: string,
  ) {
    const { data, error } = await createServerClient().rpc(
      "transition_maintenance_cost_item",
      {
        p_hotel_id: hotelId,
        p_cost_item_id: id,
        p_actor_id: actorId,
        p_action: action,
        p_reason: reason,
      },
    );
    if (error) return { result: "conflict" as const };
    if (!data) return { result: "not-found" as const };
    return { result: "ok" as const, item: (await this.getCost(hotelId, id))! };
  }

  async settleCostItem(
    hotelId: string,
    id: string,
    actorId: string,
    input: {
      amount: number;
      method: string;
      settled_at?: string;
      reference_code?: string;
      note?: string;
    },
  ) {
    const { data, error } = await createServerClient().rpc(
      "settle_maintenance_cost_item",
      {
        p_hotel_id: hotelId,
        p_cost_item_id: id,
        p_actor_id: actorId,
        p_amount: input.amount,
        p_method: input.method,
        p_paid_at: input.settled_at,
        p_reference_code: input.reference_code,
        p_note: input.note,
      },
    );
    if (error) return { result: "conflict" as const };
    if (!data) return { result: "not-found" as const };
    return { result: "ok" as const, item: (await this.getCost(hotelId, id))! };
  }

  async createRecovery(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    input: AdminMaintenanceRecoveryInput,
  ) {
    const { data, error } = await createServerClient()
      .from("maintenance_recoveries")
      .insert({
        hotel_id: hotelId,
        occurrence_id: occurrenceId,
        responsible_party: input.responsible_party,
        stay_id: input.stay_id || null,
        debtor_name: input.debtor_name?.trim() || null,
        supplier_id: input.supplier_id || null,
        contract_id: input.contract_id || null,
        charge_amount: input.charge_amount,
        waived_amount: input.waived_amount ?? 0,
        currency: await this.currency(hotelId),
        justification: input.justification.trim(),
        due_date: input.due_date || null,
        created_by: actorId,
      })
      .select("id")
      .single();
    if (error || !data) return { result: "conflict" as const };
    return {
      result: "ok" as const,
      item: (await this.getRecovery(hotelId, data.id))!,
    };
  }

  async updateRecovery(
    hotelId: string,
    id: string,
    actorId: string,
    input: AdminMaintenanceRecoveryInput,
  ) {
    const current = await this.getRecovery(hotelId, id);
    if (!current) return { result: "not-found" as const };
    if (
      !["draft", "rejected"].includes(current.approval_status) ||
      current.created_by !== actorId
    )
      return { result: "conflict" as const };
    const { error } = await createServerClient()
      .from("maintenance_recoveries")
      .update({
        responsible_party: input.responsible_party,
        stay_id: input.stay_id || null,
        debtor_name: input.debtor_name?.trim() || null,
        supplier_id: input.supplier_id || null,
        contract_id: input.contract_id || null,
        charge_amount: input.charge_amount,
        waived_amount: input.waived_amount ?? 0,
        justification: input.justification.trim(),
        due_date: input.due_date || null,
      })
      .eq("hotel_id", hotelId)
      .eq("id", id);
    if (error) return { result: "conflict" as const };
    return {
      result: "ok" as const,
      item: (await this.getRecovery(hotelId, id))!,
    };
  }

  async transitionRecovery(
    hotelId: string,
    id: string,
    actorId: string,
    action: string,
    reason?: string,
  ) {
    const { data, error } = await createServerClient().rpc(
      "transition_maintenance_recovery",
      {
        p_hotel_id: hotelId,
        p_recovery_id: id,
        p_actor_id: actorId,
        p_action: action,
        p_reason: reason,
      },
    );
    if (error) return { result: "conflict" as const };
    if (!data) return { result: "not-found" as const };
    return {
      result: "ok" as const,
      item: (await this.getRecovery(hotelId, id))!,
    };
  }

  async settleRecovery(
    hotelId: string,
    id: string,
    actorId: string,
    input: {
      amount: number;
      method: string;
      settled_at?: string;
      reference_code?: string;
      note?: string;
      allocations?: Array<{ debit_entry_id: string; amount: number }>;
    },
  ) {
    const { data, error } = await createServerClient().rpc(
      "settle_maintenance_recovery",
      {
        p_hotel_id: hotelId,
        p_recovery_id: id,
        p_actor_id: actorId,
        p_amount: input.amount,
        p_method: input.method,
        p_paid_at: input.settled_at,
        p_reference_code: input.reference_code,
        p_note: input.note,
        p_allocations: (input.allocations || null) as Json,
      },
    );
    if (error) return { result: "conflict" as const };
    if (!data) return { result: "not-found" as const };
    return {
      result: "ok" as const,
      item: (await this.getRecovery(hotelId, id))!,
    };
  }

  async reverseSettlement(
    hotelId: string,
    id: string,
    actorId: string,
    reason: string,
  ) {
    const { data, error } = await createServerClient().rpc(
      "reverse_maintenance_financial_settlement",
      {
        p_hotel_id: hotelId,
        p_settlement_id: id,
        p_actor_id: actorId,
        p_reason: reason,
      },
    );
    if (error) return { result: "conflict" as const };
    if (!data) return { result: "not-found" as const };
    const item = await this.getOccurrenceFinance(hotelId, data);
    return item
      ? { result: "ok" as const, item }
      : { result: "not-found" as const };
  }

  async countAttachments(hotelId: string, occurrenceId: string) {
    const { count, error } = await createServerClient()
      .from("maintenance_financial_attachments")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("occurrence_id", occurrenceId)
      .is("removed_at", null);
    if (error) throw error;
    return count || 0;
  }

  async createUploadIntent(
    hotelId: string,
    occurrenceId: string,
    filename: string,
  ) {
    const extension = filename.includes(".")
      ? filename
          .slice(filename.lastIndexOf("."))
          .toLowerCase()
          .replace(/[^.a-z0-9]/g, "")
      : "";
    const storagePath = `${hotelId}/${occurrenceId}/${crypto.randomUUID()}${extension}`;
    const { data, error } = await createServerClient()
      .storage.from("maintenance-financial-documents")
      .createSignedUploadUrl(storagePath);
    if (error || !data)
      throw error || new Error("Upload intent was not created");
    return {
      storage_path: storagePath,
      token: data.token,
      signed_url: data.signedUrl,
    };
  }

  async finalizeAttachments(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    targetType: "cost_item" | "recovery",
    targetId: string,
    files: Array<Record<string, unknown>>,
  ) {
    const finance = await this.getOccurrenceFinance(hotelId, occurrenceId);
    if (!finance) return { result: "not-found" as const };
    const targetExists =
      targetType === "cost_item"
        ? finance.cost_items.some((item) => item.id === targetId)
        : finance.recoveries.some((item) => item.id === targetId);
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]);
    if (
      !targetExists ||
      !files.length ||
      files.length > 5 ||
      (await this.countAttachments(hotelId, occurrenceId)) + files.length >
        20 ||
      files.some(
        (file) =>
          !String(file.storage_path || "").startsWith(
            `${hotelId}/${occurrenceId}/`,
          ) ||
          !allowed.has(String(file.content_type)) ||
          Number(file.size_bytes) <= 0 ||
          Number(file.size_bytes) > 10485760,
      )
    )
      return { result: "conflict" as const };
    const bucket = createServerClient().storage.from(
      "maintenance-financial-documents",
    );
    const verified = await Promise.all(
      files.map(async (file) => {
        const path = String(file.storage_path);
        const filename = path.slice(path.lastIndexOf("/") + 1);
        const { data, error } = await bucket.list(
          `${hotelId}/${occurrenceId}`,
          { search: filename, limit: 2 },
        );
        const object = (data || []).find((entry) => entry.name === filename);
        const metadata = object?.metadata as
          { mimetype?: string; size?: number } | undefined;
        return (
          !error &&
          object &&
          Number(metadata?.size || 0) === Number(file.size_bytes) &&
          String(metadata?.mimetype || "") === String(file.content_type)
        );
      }),
    );
    if (verified.some((value) => !value))
      return { result: "conflict" as const };
    const supabase = createServerClient();
    const { error } = await supabase
      .from("maintenance_financial_attachments")
      .insert(
        files.map((file) => ({
          hotel_id: hotelId,
          occurrence_id: occurrenceId,
          cost_item_id: targetType === "cost_item" ? targetId : null,
          recovery_id: targetType === "recovery" ? targetId : null,
          storage_path: String(file.storage_path),
          original_filename: String(file.filename),
          content_type: String(file.content_type),
          size_bytes: Number(file.size_bytes),
          uploaded_by: actorId,
        })),
      );
    if (error) return { result: "conflict" as const };
    const event = await supabase.from("maintenance_events").insert({
      hotel_id: hotelId,
      occurrence_id: occurrenceId,
      actor_id: actorId,
      event_type: "finance_documents_added",
      message: `${files.length} documento(s) financeiro(s) adicionado(s).`,
      metadata: {
        target_type: targetType,
        target_id: targetId,
        document_count: files.length,
      },
    });
    if (event.error) return { result: "conflict" as const };
    return {
      result: "ok" as const,
      item: (await this.getOccurrenceFinance(hotelId, occurrenceId))!,
    };
  }

  async createAttachmentAccess(hotelId: string, id: string) {
    const { data, error } = await createServerClient()
      .from("maintenance_financial_attachments")
      .select("storage_path")
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle();
    if (error || !data) return null;
    const signed = await createServerClient()
      .storage.from("maintenance-financial-documents")
      .createSignedUrl(data.storage_path, 300);
    return signed.error || !signed.data
      ? null
      : { signed_url: signed.data.signedUrl, expires_in: 300 };
  }

  async removeAttachment(
    hotelId: string,
    id: string,
    actorId: string,
    reason: string,
  ) {
    if (!reason.trim()) return { result: "conflict" as const };
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("maintenance_financial_attachments")
      .select("occurrence_id,storage_path,removed_at")
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return { result: "not-found" as const };
    if (data.removed_at) return { result: "conflict" as const };
    const removed = await supabase.storage
      .from("maintenance-financial-documents")
      .remove([data.storage_path]);
    if (removed.error) return { result: "conflict" as const };
    const update = await supabase
      .from("maintenance_financial_attachments")
      .update({
        removed_at: new Date().toISOString(),
        removed_by: actorId,
        removal_reason: reason,
      })
      .eq("hotel_id", hotelId)
      .eq("id", id);
    if (update.error) return { result: "conflict" as const };
    const event = await supabase.from("maintenance_events").insert({
      hotel_id: hotelId,
      occurrence_id: data.occurrence_id,
      actor_id: actorId,
      event_type: "finance_document_removed",
      message: reason.trim(),
      metadata: { attachment_id: id },
    });
    if (event.error) return { result: "conflict" as const };
    return {
      result: "ok" as const,
      item: (await this.getOccurrenceFinance(hotelId, data.occurrence_id))!,
    };
  }
}

export function createMaintenanceFinanceRepository(): MaintenanceFinanceRepository {
  return new SupabaseMaintenanceFinanceRepository();
}
