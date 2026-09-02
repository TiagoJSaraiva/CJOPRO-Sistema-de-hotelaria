import type {
  AdminMaintenanceAnalytics,
  AdminMaintenanceAutomationRun,
  AdminMaintenanceContract,
  AdminMaintenanceNotification,
  AdminMaintenancePreventivePlan,
  AdminMaintenancePreventivePlanInput,
  AdminMaintenancePreventiveRun,
  AdminMaintenanceSlaPolicy,
  AdminMaintenanceSupplier,
  AdminMaintenanceSupplierContact,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

type WriteResult<T> =
  { result: "ok"; item: T } | { result: "not-found" | "conflict" };

type PlanRow = Tables<"maintenance_preventive_plans"> & {
  category?: { name: string } | null;
  room?: { room_number: string } | null;
  location?: { name: string } | null;
  assignee?: { name: string } | null;
  supplier?: { name: string } | null;
  contract?: { contract_number: string } | null;
};
type SupplierRow = Tables<"maintenance_suppliers"> & {
  contacts?: Tables<"maintenance_supplier_contacts">[] | null;
  contracts?: ContractRow[] | null;
  documents?: Array<{
    id: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    created_at: string;
  }> | null;
};
type ContractRow = Tables<"maintenance_contracts"> & {
  category_scopes?: Array<{ category_id: string; is_active: boolean }> | null;
  location_scopes?: Array<{ location_id: string; is_active: boolean }> | null;
  documents?: Array<{
    id: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    created_at: string;
    removed_at?: string | null;
  }> | null;
};

const planSelect =
  "*,category:category_id(name),room:room_id(room_number),location:location_id(name),assignee:assigned_to(name),supplier:supplier_id(name),contract:contract_id(contract_number)";

function number(value: unknown) {
  return Number(value || 0);
}

function rpcNullable<T>(value: T | null | undefined): T {
  return (value ?? null) as T;
}

function mapRun(
  row: Tables<"maintenance_preventive_runs">,
): AdminMaintenancePreventiveRun {
  return {
    id: row.id,
    plan_id: row.plan_id,
    scheduled_for: row.scheduled_for,
    scheduled_local_date: row.scheduled_local_date,
    status: row.status,
    occurrence_id: row.occurrence_id,
    work_order_id: row.work_order_id,
    snapshot: (row.snapshot || {}) as Record<string, unknown>,
    decision_reason: row.decision_reason,
    rescheduled_for: row.rescheduled_for,
    created_at: row.created_at,
  };
}

export interface MaintenanceManagementRepository {
  listPlans(hotelId: string): Promise<AdminMaintenancePreventivePlan[]>;
  getPlan(
    hotelId: string,
    id: string,
  ): Promise<AdminMaintenancePreventivePlan | null>;
  savePlan(
    hotelId: string,
    actorId: string,
    input: AdminMaintenancePreventivePlanInput,
    id?: string,
  ): Promise<WriteResult<AdminMaintenancePreventivePlan>>;
  setPlanStatus(
    hotelId: string,
    actorId: string,
    id: string,
    status: "active" | "paused" | "inactive",
  ): Promise<WriteResult<AdminMaintenancePreventivePlan>>;
  listRuns(
    hotelId: string,
    planId: string,
  ): Promise<AdminMaintenancePreventiveRun[]>;
  decideRun(
    hotelId: string,
    actorId: string,
    id: string,
    action: "generate" | "skip" | "reschedule",
    reason: string,
    date?: string,
  ): Promise<WriteResult<AdminMaintenancePreventiveRun>>;
  completeChecklist(
    hotelId: string,
    actorId: string,
    orderId: string,
    itemId: string,
    completed: boolean,
    notes?: string,
  ): Promise<string | null>;
  transitionSupplierWork(
    hotelId: string,
    actorId: string,
    orderId: string,
    input: Record<string, unknown>,
  ): Promise<string | null>;
  listSlaPolicies(hotelId: string): Promise<AdminMaintenanceSlaPolicy[]>;
  createSlaPolicy(
    hotelId: string,
    actorId: string,
    input: Record<string, unknown>,
  ): Promise<WriteResult<AdminMaintenanceSlaPolicy>>;
  updateSlaPolicy(
    hotelId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<WriteResult<AdminMaintenanceSlaPolicy>>;
  listSuppliers(
    hotelId: string,
    includeCommercial: boolean,
    limited?: boolean,
  ): Promise<AdminMaintenanceSupplier[]>;
  createSupplier(
    hotelId: string,
    actorId: string,
    input: Record<string, unknown>,
  ): Promise<WriteResult<AdminMaintenanceSupplier>>;
  updateSupplier(
    hotelId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<WriteResult<AdminMaintenanceSupplier>>;
  createContact(
    hotelId: string,
    actorId: string,
    supplierId: string,
    input: Record<string, unknown>,
  ): Promise<WriteResult<AdminMaintenanceSupplierContact>>;
  updateContact(
    hotelId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<WriteResult<AdminMaintenanceSupplierContact>>;
  createContract(
    hotelId: string,
    actorId: string,
    supplierId: string,
    input: Record<string, unknown>,
  ): Promise<WriteResult<AdminMaintenanceContract>>;
  updateContract(
    hotelId: string,
    actorId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<WriteResult<AdminMaintenanceContract>>;
  listNotifications(
    hotelId: string,
    recipientId: string,
    filters: { status?: string; kind?: string },
  ): Promise<AdminMaintenanceNotification[]>;
  notificationSummary(hotelId: string, recipientId: string): Promise<number>;
  setNotificationStatus(
    hotelId: string,
    recipientId: string,
    id: string,
    status: "unread" | "read" | "dismissed",
  ): Promise<boolean>;
  readAllNotifications(hotelId: string, recipientId: string): Promise<number>;
  analytics(
    hotelId: string,
    filters: Record<string, string | undefined>,
    includeFinancial: boolean,
  ): Promise<AdminMaintenanceAnalytics>;
  exportRows(
    hotelId: string,
    filters: Record<string, string | undefined>,
    includeFinancial: boolean,
  ): Promise<Array<Record<string, unknown>>>;
  listAutomationRuns(hotelId: string): Promise<AdminMaintenanceAutomationRun[]>;
  runAutomation(hotelId: string): Promise<unknown>;
  createDocumentUploadIntent(
    hotelId: string,
    targetType: "supplier" | "contract",
    targetId: string,
    filename: string,
  ): Promise<{ storage_path: string; token: string; signed_url: string }>;
  finalizeDocuments(
    hotelId: string,
    actorId: string,
    targetType: "supplier" | "contract",
    targetId: string,
    files: Array<Record<string, unknown>>,
  ): Promise<boolean>;
  accessDocument(
    hotelId: string,
    id: string,
  ): Promise<{ signed_url: string; expires_in: number } | null>;
  removeDocument(
    hotelId: string,
    actorId: string,
    id: string,
    reason: string,
  ): Promise<boolean>;
}

class SupabaseMaintenanceManagementRepository implements MaintenanceManagementRepository {
  private async mapPlan(row: PlanRow): Promise<AdminMaintenancePreventivePlan> {
    const tasks = await createServerClient()
      .from("maintenance_preventive_plan_tasks")
      .select("id,position,description,is_required")
      .eq("plan_id", row.id)
      .eq("is_active", true)
      .order("position");
    if (tasks.error) throw tasks.error;
    return {
      id: row.id,
      hotel_id: row.hotel_id,
      name: row.name,
      category_id: row.category_id,
      room_id: row.room_id,
      location_id: row.location_id,
      assigned_to: row.assigned_to,
      supplier_id: row.supplier_id,
      contract_id: row.contract_id,
      priority: row.priority,
      instructions: row.instructions,
      requires_inspection: row.requires_inspection,
      blocking_recommended: row.blocking_recommended,
      recurrence_unit: row.recurrence_unit,
      recurrence_interval: row.recurrence_interval,
      starts_on: row.starts_on,
      ends_on: row.ends_on,
      local_time: row.local_time,
      generation_lead_days: row.generation_lead_days,
      completion_due_hours: row.completion_due_hours,
      tasks: tasks.data || [],
      recurrence_day: row.recurrence_day,
      next_due_date: row.next_due_date,
      status: row.status,
      category_name: row.category?.name,
      target_name: row.room?.room_number || row.location?.name,
      assignee_name: row.assignee?.name,
      supplier_name: row.supplier?.name || null,
      contract_number: row.contract?.contract_number || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async listPlans(hotelId: string) {
    const result = await createServerClient()
      .from("maintenance_preventive_plans")
      .select(planSelect)
      .eq("hotel_id", hotelId)
      .order("next_due_date");
    if (result.error) throw result.error;
    return Promise.all(
      (result.data || []).map((row) => this.mapPlan(row as PlanRow)),
    );
  }

  async getPlan(hotelId: string, id: string) {
    const result = await createServerClient()
      .from("maintenance_preventive_plans")
      .select(planSelect)
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data ? this.mapPlan(result.data as PlanRow) : null;
  }

  async savePlan(
    hotelId: string,
    actorId: string,
    input: AdminMaintenancePreventivePlanInput,
    id?: string,
  ) {
    const result = await createServerClient().rpc(
      "upsert_maintenance_preventive_plan",
      {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_plan_id: rpcNullable(id),
        p_name: input.name,
        p_category_id: input.category_id,
        p_room_id: rpcNullable(input.room_id),
        p_location_id: rpcNullable(input.location_id),
        p_assigned_to: input.assigned_to,
        p_supplier_id: rpcNullable(input.supplier_id),
        p_contract_id: rpcNullable(input.contract_id),
        p_priority: input.priority || "normal",
        p_instructions: input.instructions,
        p_requires_inspection: input.requires_inspection || false,
        p_blocking_recommended: input.blocking_recommended || false,
        p_recurrence_unit: input.recurrence_unit,
        p_recurrence_interval: input.recurrence_interval || 1,
        p_starts_on: input.starts_on,
        p_ends_on: rpcNullable(input.ends_on),
        p_local_time: input.local_time,
        p_generation_lead_days: input.generation_lead_days || 0,
        p_completion_due_hours: input.completion_due_hours || 24,
        p_tasks: input.tasks as Json,
      },
    );
    if (result.error) return { result: "conflict" } as const;
    if (!result.data) return { result: "not-found" } as const;
    const item = await this.getPlan(hotelId, result.data);
    return item
      ? ({ result: "ok", item } as const)
      : ({ result: "not-found" } as const);
  }

  async setPlanStatus(
    hotelId: string,
    actorId: string,
    id: string,
    status: "active" | "paused" | "inactive",
  ) {
    const now = new Date().toISOString();
    const patch =
      status === "paused"
        ? {
            status,
            paused_by: actorId,
            paused_at: now,
            deactivated_by: null,
            deactivated_at: null,
          }
        : status === "inactive"
          ? {
              status,
              paused_by: null,
              paused_at: null,
              deactivated_by: actorId,
              deactivated_at: now,
            }
          : {
              status,
              paused_by: null,
              paused_at: null,
              deactivated_by: null,
              deactivated_at: null,
            };
    const result = await createServerClient()
      .from("maintenance_preventive_plans")
      .update(patch)
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (result.error) return { result: "conflict" } as const;
    if (!result.data) return { result: "not-found" } as const;
    const item = await this.getPlan(hotelId, id);
    return item
      ? ({ result: "ok", item } as const)
      : ({ result: "not-found" } as const);
  }

  async listRuns(hotelId: string, planId: string) {
    const result = await createServerClient()
      .from("maintenance_preventive_runs")
      .select("*")
      .eq("hotel_id", hotelId)
      .eq("plan_id", planId)
      .order("scheduled_for", { ascending: false });
    if (result.error) throw result.error;
    return (result.data || []).map(mapRun);
  }

  async decideRun(
    hotelId: string,
    actorId: string,
    id: string,
    action: "generate" | "skip" | "reschedule",
    reason: string,
    date?: string,
  ) {
    const result = await createServerClient().rpc(
      "decide_maintenance_preventive_run",
      {
        p_hotel_id: hotelId,
        p_run_id: id,
        p_actor_id: actorId,
        p_action: action,
        p_reason: reason,
        p_rescheduled_for: date,
      },
    );
    if (result.error) return { result: "conflict" } as const;
    if (!result.data) return { result: "not-found" } as const;
    const itemResult = await createServerClient()
      .from("maintenance_preventive_runs")
      .select("*")
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .maybeSingle();
    if (itemResult.error || !itemResult.data)
      return { result: "not-found" } as const;
    return { result: "ok", item: mapRun(itemResult.data) } as const;
  }

  async completeChecklist(
    hotelId: string,
    actorId: string,
    orderId: string,
    itemId: string,
    completed: boolean,
    notes?: string,
  ) {
    const result = await createServerClient().rpc(
      "complete_maintenance_checklist_item",
      {
        p_hotel_id: hotelId,
        p_work_order_id: orderId,
        p_item_id: itemId,
        p_actor_id: actorId,
        p_completed: completed,
        p_notes: notes,
      },
    );
    if (result.error) return null;
    return result.data;
  }

  async transitionSupplierWork(
    hotelId: string,
    actorId: string,
    orderId: string,
    input: Record<string, unknown>,
  ) {
    const result = await createServerClient().rpc(
      "transition_maintenance_supplier_work",
      {
        p_hotel_id: hotelId,
        p_work_order_id: orderId,
        p_actor_id: actorId,
        p_action: String(input.action || ""),
        p_supplier_id: input.supplier_id as string | undefined,
        p_contract_id: input.contract_id as string | undefined,
        p_external_reference: input.external_reference as string | undefined,
        p_notes: input.notes as string | undefined,
      },
    );
    if (result.error) return null;
    return result.data;
  }

  async listSlaPolicies(hotelId: string) {
    const result = await createServerClient()
      .from("maintenance_sla_policies")
      .select("*,category:category_id(name)")
      .eq("hotel_id", hotelId)
      .order("priority");
    if (result.error) throw result.error;
    return (result.data || []).map((row) => this.mapSlaPolicy(row));
  }

  private mapSlaPolicy(
    row: Tables<"maintenance_sla_policies"> & {
      category?: { name: string } | null;
    },
  ): AdminMaintenanceSlaPolicy {
    return {
      id: row.id,
      hotel_id: row.hotel_id,
      category_id: row.category_id,
      category_name: row.category?.name || null,
      priority: row.priority,
      name: row.name,
      response_hours: row.response_hours,
      resolution_hours: row.resolution_hours,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async createSlaPolicy(
    hotelId: string,
    actorId: string,
    input: Record<string, unknown>,
  ) {
    const payload: TablesInsert<"maintenance_sla_policies"> = {
      hotel_id: hotelId,
      created_by: actorId,
      category_id: rpcNullable(input.category_id as string | null | undefined),
      priority:
        input.priority as TablesInsert<"maintenance_sla_policies">["priority"],
      name: String(input.name),
      response_hours: Number(input.response_hours),
      resolution_hours: Number(input.resolution_hours),
      is_active:
        input.is_active === undefined ? true : Boolean(input.is_active),
    };
    const result = await createServerClient()
      .from("maintenance_sla_policies")
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (result.error) return { result: "conflict" } as const;
    return result.data
      ? ({ result: "ok", item: this.mapSlaPolicy(result.data) } as const)
      : ({ result: "not-found" } as const);
  }

  async updateSlaPolicy(
    hotelId: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    const payload: TablesUpdate<"maintenance_sla_policies"> = {};
    if (input.category_id !== undefined)
      payload.category_id = input.category_id as string | null;
    if (input.priority !== undefined)
      payload.priority =
        input.priority as TablesUpdate<"maintenance_sla_policies">["priority"];
    if (input.name !== undefined) payload.name = String(input.name);
    if (input.response_hours !== undefined)
      payload.response_hours = Number(input.response_hours);
    if (input.resolution_hours !== undefined)
      payload.resolution_hours = Number(input.resolution_hours);
    if (input.is_active !== undefined)
      payload.is_active = Boolean(input.is_active);
    const result = await createServerClient()
      .from("maintenance_sla_policies")
      .update(payload)
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (result.error) return { result: "conflict" } as const;
    return result.data
      ? ({ result: "ok", item: this.mapSlaPolicy(result.data) } as const)
      : ({ result: "not-found" } as const);
  }

  private mapContact(
    row: Tables<"maintenance_supplier_contacts">,
  ): AdminMaintenanceSupplierContact {
    return {
      id: row.id,
      supplier_id: row.supplier_id,
      name: row.name,
      role: row.role,
      email: row.email,
      phone: row.phone,
      is_primary: row.is_primary,
      is_active: row.is_active,
    };
  }

  private mapContract(
    row: ContractRow,
    includeCommercial: boolean,
  ): AdminMaintenanceContract {
    return {
      id: row.id,
      supplier_id: row.supplier_id,
      contract_number: row.contract_number,
      kind: row.kind,
      status: row.status,
      starts_on: row.starts_on,
      ends_on: row.ends_on,
      renewal_notice_on: row.renewal_notice_on,
      scope_notes: row.scope_notes,
      response_hours: row.response_hours,
      resolution_hours: row.resolution_hours,
      commercial_terms: includeCommercial ? row.commercial_terms : undefined,
      contract_amount: includeCommercial
        ? row.contract_amount == null
          ? null
          : number(row.contract_amount)
        : undefined,
      currency: includeCommercial ? row.currency : undefined,
      category_ids: (row.category_scopes || [])
        .filter((scope) => scope.is_active)
        .map((scope) => scope.category_id),
      location_ids: (row.location_scopes || [])
        .filter((scope) => scope.is_active)
        .map((scope) => scope.location_id),
      documents: (row.documents || [])
        .filter((document) => !document.removed_at)
        .map((document) => ({
          id: document.id,
          original_filename: document.original_filename,
          content_type: document.content_type,
          size_bytes: Number(document.size_bytes),
          created_at: document.created_at,
        })),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapSupplier(
    row: SupplierRow,
    includeCommercial: boolean,
  ): AdminMaintenanceSupplier {
    return {
      id: row.id,
      hotel_id: row.hotel_id,
      name: row.name,
      legal_name: row.legal_name,
      tax_document: row.tax_document,
      email: row.email,
      phone: row.phone,
      specialties: row.specialties,
      notes: row.notes,
      status: row.status,
      contacts: (row.contacts || []).map((contact) => this.mapContact(contact)),
      contracts: (row.contracts || []).map((contract) =>
        this.mapContract(contract, includeCommercial),
      ),
      documents: (row.documents || []).map((document) => ({
        id: document.id,
        original_filename: document.original_filename,
        content_type: document.content_type,
        size_bytes: Number(document.size_bytes),
        created_at: document.created_at,
      })),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async listSuppliers(
    hotelId: string,
    includeCommercial: boolean,
    limited = false,
  ) {
    const result = await createServerClient()
      .from("maintenance_suppliers")
      .select(
        "*,contacts:maintenance_supplier_contacts(*),contracts:maintenance_contracts(*,category_scopes:maintenance_contract_categories(category_id,is_active),location_scopes:maintenance_contract_locations(location_id,is_active),documents:maintenance_management_attachments(id,original_filename,content_type,size_bytes,created_at,removed_at)),documents:maintenance_management_attachments(id,original_filename,content_type,size_bytes,created_at,removed_at)",
      )
      .eq("hotel_id", hotelId)
      .order("name");
    if (result.error) throw result.error;
    return (result.data || []).map((row) => {
      const item = this.mapSupplier(
        {
          ...row,
          documents: (row.documents || []).filter(
            (document) => !document.removed_at,
          ),
        } as SupplierRow,
        includeCommercial,
      );
      return limited
        ? {
            ...item,
            legal_name: null,
            tax_document: null,
            email: null,
            phone: null,
            specialties: [],
            notes: null,
            contacts: [],
            contracts: (item.contracts || []).map((contract) => ({
              ...contract,
              commercial_terms: undefined,
              contract_amount: undefined,
              currency: undefined,
              documents: [],
            })),
            documents: [],
          }
        : item;
    });
  }

  async createSupplier(
    hotelId: string,
    actorId: string,
    input: Record<string, unknown>,
  ) {
    const payload: TablesInsert<"maintenance_suppliers"> = {
      hotel_id: hotelId,
      created_by: actorId,
      name: String(input.name),
      legal_name: input.legal_name as string | null | undefined,
      tax_document: input.tax_document as string | null | undefined,
      email: input.email as string | null | undefined,
      phone: input.phone as string | null | undefined,
      specialties: (input.specialties || []) as string[],
      notes: input.notes as string | null | undefined,
      status: (input.status ||
        "active") as TablesInsert<"maintenance_suppliers">["status"],
    };
    const result = await createServerClient()
      .from("maintenance_suppliers")
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (result.error) return { result: "conflict" } as const;
    return result.data
      ? ({ result: "ok", item: this.mapSupplier(result.data, false) } as const)
      : ({ result: "not-found" } as const);
  }

  async updateSupplier(
    hotelId: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    const payload: TablesUpdate<"maintenance_suppliers"> = {};
    for (const key of [
      "name",
      "legal_name",
      "tax_document",
      "email",
      "phone",
      "specialties",
      "notes",
      "status",
    ] as const) {
      if (input[key] !== undefined)
        Object.assign(payload, { [key]: input[key] });
    }
    const result = await createServerClient()
      .from("maintenance_suppliers")
      .update(payload)
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (result.error) return { result: "conflict" } as const;
    return result.data
      ? ({ result: "ok", item: this.mapSupplier(result.data, false) } as const)
      : ({ result: "not-found" } as const);
  }

  async createContact(
    hotelId: string,
    actorId: string,
    supplierId: string,
    input: Record<string, unknown>,
  ) {
    const payload: TablesInsert<"maintenance_supplier_contacts"> = {
      hotel_id: hotelId,
      supplier_id: supplierId,
      created_by: actorId,
      name: String(input.name),
      role: input.role as string | null | undefined,
      email: input.email as string | null | undefined,
      phone: input.phone as string | null | undefined,
      is_primary: Boolean(input.is_primary),
      is_active:
        input.is_active === undefined ? true : Boolean(input.is_active),
    };
    const result = await createServerClient()
      .from("maintenance_supplier_contacts")
      .insert(payload)
      .select("*")
      .maybeSingle();
    if (result.error) return { result: "conflict" } as const;
    return result.data
      ? ({ result: "ok", item: this.mapContact(result.data) } as const)
      : ({ result: "not-found" } as const);
  }

  async updateContact(
    hotelId: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    const payload: TablesUpdate<"maintenance_supplier_contacts"> = {};
    for (const key of [
      "name",
      "role",
      "email",
      "phone",
      "is_primary",
      "is_active",
    ] as const) {
      if (input[key] !== undefined)
        Object.assign(payload, { [key]: input[key] });
    }
    const result = await createServerClient()
      .from("maintenance_supplier_contacts")
      .update(payload)
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (result.error) return { result: "conflict" } as const;
    return result.data
      ? ({ result: "ok", item: this.mapContact(result.data) } as const)
      : ({ result: "not-found" } as const);
  }

  async createContract(
    hotelId: string,
    actorId: string,
    supplierId: string,
    input: Record<string, unknown>,
  ) {
    const result = await createServerClient().rpc(
      "upsert_maintenance_contract",
      {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_contract_id: rpcNullable<string>(undefined),
        p_supplier_id: supplierId,
        p_contract_number: String(input.contract_number),
        p_kind: input.kind as "fixed" | "per_service" | "warranty" | "other",
        p_status: (input.status || "draft") as
          "draft" | "active" | "expired" | "terminated",
        p_starts_on: String(input.starts_on),
        p_ends_on: rpcNullable(input.ends_on as string | null | undefined),
        p_renewal_notice_on: rpcNullable(
          input.renewal_notice_on as string | null | undefined,
        ),
        p_scope_notes: rpcNullable(
          input.scope_notes as string | null | undefined,
        ),
        p_response_hours: rpcNullable(
          input.response_hours as number | null | undefined,
        ),
        p_resolution_hours: rpcNullable(
          input.resolution_hours as number | null | undefined,
        ),
        p_commercial_terms: rpcNullable(
          input.commercial_terms as string | null | undefined,
        ),
        p_contract_amount: rpcNullable(
          input.contract_amount as number | null | undefined,
        ),
        p_currency: rpcNullable(input.currency as string | null | undefined),
        p_category_ids: (input.category_ids || []) as string[],
        p_location_ids: (input.location_ids || []) as string[],
        p_termination_reason: rpcNullable<string>(undefined),
      },
    );
    if (result.error) return { result: "conflict" } as const;
    if (!result.data) return { result: "not-found" } as const;
    const item = await createServerClient()
      .from("maintenance_contracts")
      .select(
        "*,category_scopes:maintenance_contract_categories(category_id,is_active),location_scopes:maintenance_contract_locations(location_id,is_active),documents:maintenance_management_attachments(id,original_filename,content_type,size_bytes,created_at,removed_at)",
      )
      .eq("hotel_id", hotelId)
      .eq("id", result.data)
      .single();
    return item.error
      ? ({ result: "conflict" } as const)
      : ({
          result: "ok",
          item: this.mapContract(item.data as ContractRow, true),
        } as const);
  }

  async updateContract(
    hotelId: string,
    actorId: string,
    id: string,
    input: Record<string, unknown>,
  ) {
    const currentResult = await createServerClient()
      .from("maintenance_contracts")
      .select(
        "*,category_scopes:maintenance_contract_categories(category_id,is_active),location_scopes:maintenance_contract_locations(location_id,is_active)",
      )
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .maybeSingle();
    if (currentResult.error || !currentResult.data)
      return { result: "not-found" } as const;
    const current = currentResult.data;
    return this.createOrUpdateContract(
      hotelId,
      actorId,
      id,
      current.supplier_id,
      {
        ...current,
        ...input,
        category_ids:
          input.category_ids ||
          (current.category_scopes || [])
            .filter((scope) => scope.is_active)
            .map((scope) => scope.category_id),
        location_ids:
          input.location_ids ||
          (current.location_scopes || [])
            .filter((scope) => scope.is_active)
            .map((scope) => scope.location_id),
      },
    );
  }

  private async createOrUpdateContract(
    hotelId: string,
    actorId: string,
    id: string,
    supplierId: string,
    input: Record<string, unknown>,
  ): Promise<WriteResult<AdminMaintenanceContract>> {
    const result = await createServerClient().rpc(
      "upsert_maintenance_contract",
      {
        p_hotel_id: hotelId,
        p_actor_id: actorId,
        p_contract_id: id,
        p_supplier_id: supplierId,
        p_contract_number: String(input.contract_number),
        p_kind: input.kind as "fixed" | "per_service" | "warranty" | "other",
        p_status: input.status as "draft" | "active" | "expired" | "terminated",
        p_starts_on: String(input.starts_on),
        p_ends_on: rpcNullable(input.ends_on as string | null | undefined),
        p_renewal_notice_on: rpcNullable(
          input.renewal_notice_on as string | null | undefined,
        ),
        p_scope_notes: rpcNullable(
          input.scope_notes as string | null | undefined,
        ),
        p_response_hours: rpcNullable(
          input.response_hours as number | null | undefined,
        ),
        p_resolution_hours: rpcNullable(
          input.resolution_hours as number | null | undefined,
        ),
        p_commercial_terms: rpcNullable(
          input.commercial_terms as string | null | undefined,
        ),
        p_contract_amount: rpcNullable(
          input.contract_amount as number | null | undefined,
        ),
        p_currency: rpcNullable(input.currency as string | null | undefined),
        p_category_ids: (input.category_ids || []) as string[],
        p_location_ids: (input.location_ids || []) as string[],
        p_termination_reason: input.termination_reason as string | undefined,
      },
    );
    if (result.error) return { result: "conflict" };
    if (!result.data) return { result: "not-found" };
    const item = await createServerClient()
      .from("maintenance_contracts")
      .select(
        "*,category_scopes:maintenance_contract_categories(category_id,is_active),location_scopes:maintenance_contract_locations(location_id,is_active),documents:maintenance_management_attachments(id,original_filename,content_type,size_bytes,created_at,removed_at)",
      )
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .single();
    return item.error
      ? { result: "conflict" }
      : {
          result: "ok",
          item: this.mapContract(item.data as ContractRow, true),
        };
  }

  async listNotifications(
    hotelId: string,
    recipientId: string,
    filters: { status?: string; kind?: string },
  ) {
    let query = createServerClient()
      .from("maintenance_notifications")
      .select(
        "id,kind,severity,title,message,href,entity_type,entity_id,status,created_at",
      )
      .eq("hotel_id", hotelId)
      .eq("recipient_id", recipientId);
    if (filters.status)
      query = query.eq(
        "status",
        filters.status as "unread" | "read" | "dismissed",
      );
    if (filters.kind) query = query.eq("kind", filters.kind);
    const result = await query
      .order("created_at", { ascending: false })
      .limit(100);
    if (result.error) throw result.error;
    return result.data as AdminMaintenanceNotification[];
  }

  async notificationSummary(hotelId: string, recipientId: string) {
    const result = await createServerClient()
      .from("maintenance_notifications")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("recipient_id", recipientId)
      .eq("status", "unread");
    if (result.error) throw result.error;
    return result.count || 0;
  }

  async setNotificationStatus(
    hotelId: string,
    recipientId: string,
    id: string,
    status: "unread" | "read" | "dismissed",
  ) {
    const result = await createServerClient().rpc(
      "set_maintenance_notification_status",
      {
        p_hotel_id: hotelId,
        p_recipient_id: recipientId,
        p_notification_id: id,
        p_status: status,
      },
    );
    if (result.error) return false;
    return result.data;
  }

  async readAllNotifications(hotelId: string, recipientId: string) {
    const result = await createServerClient().rpc(
      "mark_all_maintenance_notifications_read",
      { p_hotel_id: hotelId, p_recipient_id: recipientId },
    );
    if (result.error) throw result.error;
    return result.data;
  }

  async analytics(
    hotelId: string,
    filters: Record<string, string | undefined>,
    includeFinancial: boolean,
  ) {
    const supabase = createServerClient();
    let occurrenceQuery = supabase
      .from("maintenance_occurrences")
      .select(
        "id,category_id,priority,status,room_id,location_id,preventive_plan_id,created_at,triaged_at,operational_resolved_at,sla_resolution_due_at",
        { count: "exact" },
      )
      .eq("hotel_id", hotelId);
    if (filters.from)
      occurrenceQuery = occurrenceQuery.gte("created_at", filters.from);
    if (filters.to)
      occurrenceQuery = occurrenceQuery.lte(
        "created_at",
        `${filters.to}T23:59:59.999Z`,
      );
    if (filters.category_id)
      occurrenceQuery = occurrenceQuery.eq("category_id", filters.category_id);
    if (filters.priority)
      occurrenceQuery = occurrenceQuery.eq(
        "priority",
        filters.priority as "low" | "normal" | "high" | "critical",
      );
    if (filters.status)
      occurrenceQuery = occurrenceQuery.eq(
        "status",
        filters.status as
          | "reported"
          | "triaged"
          | "in_progress"
          | "awaiting_inspection"
          | "awaiting_liability"
          | "resolved"
          | "canceled",
      );
    if (filters.plan_id)
      occurrenceQuery = occurrenceQuery.eq(
        "preventive_plan_id",
        filters.plan_id,
      );
    if (filters.room_id)
      occurrenceQuery = occurrenceQuery.eq("room_id", filters.room_id);
    if (filters.location_id)
      occurrenceQuery = occurrenceQuery.eq("location_id", filters.location_id);
    if (filters.supplier_id) {
      const supplierOrders = await supabase
        .from("maintenance_work_orders")
        .select("occurrence_id")
        .eq("hotel_id", hotelId)
        .eq("supplier_id", filters.supplier_id);
      if (supplierOrders.error) throw supplierOrders.error;
      const supplierOccurrenceIds = Array.from(
        new Set(
          (supplierOrders.data || []).map((order) => order.occurrence_id),
        ),
      );
      occurrenceQuery = occurrenceQuery.in(
        "id",
        supplierOccurrenceIds.length
          ? supplierOccurrenceIds
          : ["00000000-0000-0000-0000-000000000000"],
      );
    }
    const occurrences = await occurrenceQuery;
    if (occurrences.error) throw occurrences.error;
    const occurrenceIds = (occurrences.data || []).map((item) => item.id);
    let runQuery = supabase
      .from("maintenance_preventive_runs")
      .select("status,scheduled_local_date")
      .eq("hotel_id", hotelId);
    if (filters.from)
      runQuery = runQuery.gte("scheduled_local_date", filters.from);
    if (filters.to) runQuery = runQuery.lte("scheduled_local_date", filters.to);
    if (filters.plan_id) runQuery = runQuery.eq("plan_id", filters.plan_id);
    let blockQuery = supabase
      .from("room_blocks")
      .select("start_date,end_date,released_at")
      .eq("hotel_id", hotelId)
      .not("maintenance_occurrence_id", "is", null);
    if (filters.from) blockQuery = blockQuery.gte("end_date", filters.from);
    if (filters.to) blockQuery = blockQuery.lte("start_date", filters.to);
    let orderQuery = supabase
      .from("maintenance_work_orders")
      .select("supplier_id,supplier_status")
      .eq("hotel_id", hotelId)
      .not("supplier_id", "is", null);
    if (occurrenceIds.length)
      orderQuery = orderQuery.in("occurrence_id", occurrenceIds);
    else
      orderQuery = orderQuery.eq(
        "occurrence_id",
        "00000000-0000-0000-0000-000000000000",
      );
    if (filters.supplier_id)
      orderQuery = orderQuery.eq("supplier_id", filters.supplier_id);
    const [runs, blocks, orders, costs, recoveries, hotel] = await Promise.all([
      runQuery,
      blockQuery,
      orderQuery,
      includeFinancial && occurrenceIds.length
        ? supabase
            .from("maintenance_cost_items")
            .select("actual_amount,approval_status")
            .eq("hotel_id", hotelId)
            .eq("approval_status", "approved")
            .in("occurrence_id", occurrenceIds)
        : Promise.resolve({ data: [], error: null }),
      includeFinancial && occurrenceIds.length
        ? supabase
            .from("maintenance_recoveries")
            .select("charge_amount,approval_status")
            .eq("hotel_id", hotelId)
            .eq("approval_status", "approved")
            .in("occurrence_id", occurrenceIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("hotels").select("currency").eq("id", hotelId).single(),
    ]);
    const error =
      occurrences.error ||
      runs.error ||
      blocks.error ||
      orders.error ||
      costs.error ||
      recoveries.error ||
      hotel.error;
    if (error) throw error;
    const items = occurrences.data || [];
    const open = items.filter(
      (item) => !["resolved", "canceled"].includes(item.status),
    );
    const resolved = items.filter((item) => item.operational_resolved_at);
    const trackedResolved = resolved.filter(
      (item) => item.sla_resolution_due_at,
    );
    const compliant = trackedResolved.filter(
      (item) =>
        new Date(item.operational_resolved_at!).getTime() <=
        new Date(item.sla_resolution_due_at!).getTime(),
    );
    const generatedRuns = (runs.data || []).filter(
      (item) => item.status === "generated",
    );
    const fulfilledRuns = (runs.data || []).filter((item) =>
      ["generated", "skipped"].includes(item.status),
    );
    const now = Date.now();
    const agingBuckets = [
      { bucket: "0-1 dia", min: 0, max: 1 },
      { bucket: "2-7 dias", min: 1, max: 7 },
      { bucket: "8-30 dias", min: 7, max: 30 },
      { bucket: "Mais de 30 dias", min: 30, max: Infinity },
    ];
    const seriesMap = new Map<string, { opened: number; resolved: number }>();
    for (const item of items) {
      const openedDate = item.created_at.slice(0, 10);
      const current = seriesMap.get(openedDate) || { opened: 0, resolved: 0 };
      current.opened += 1;
      seriesMap.set(openedDate, current);
      if (item.operational_resolved_at) {
        const resolvedDate = item.operational_resolved_at.slice(0, 10);
        const value = seriesMap.get(resolvedDate) || { opened: 0, resolved: 0 };
        value.resolved += 1;
        seriesMap.set(resolvedDate, value);
      }
    }
    const approvedCost = (costs.data || []).reduce(
      (sum, item) => sum + number(item.actual_amount),
      0,
    );
    const approvedRecovery = (recoveries.data || []).reduce(
      (sum, item) => sum + number(item.charge_amount),
      0,
    );
    return {
      filters: Object.fromEntries(
        Object.entries(filters).filter((entry): entry is [string, string] =>
          Boolean(entry[1]),
        ),
      ),
      backlog: open.length,
      critical_open: open.filter((item) => item.priority === "critical").length,
      average_triage_hours: number(
        items
          .filter((item) => item.triaged_at)
          .reduce(
            (sum, item) =>
              sum +
              (new Date(item.triaged_at!).getTime() -
                new Date(item.created_at).getTime()) /
                3_600_000,
            0,
          ) / Math.max(items.filter((item) => item.triaged_at).length, 1),
      ),
      average_resolution_hours: number(
        resolved.reduce(
          (sum, item) =>
            sum +
            (new Date(item.operational_resolved_at!).getTime() -
              new Date(item.created_at).getTime()) /
              3_600_000,
          0,
        ) / Math.max(resolved.length, 1),
      ),
      sla_compliance_rate: number(
        (compliant.length / Math.max(trackedResolved.length, 1)) * 100,
      ),
      preventive_compliance_rate: number(
        (generatedRuns.length / Math.max(fulfilledRuns.length, 1)) * 100,
      ),
      recurring_occurrences: items.filter((item, index) =>
        items.some(
          (other, otherIndex) =>
            otherIndex < index &&
            other.category_id === item.category_id &&
            (other.room_id === item.room_id ||
              other.location_id === item.location_id) &&
            Math.abs(
              new Date(other.created_at).getTime() -
                new Date(item.created_at).getTime(),
            ) <=
              30 * 86_400_000,
        ),
      ).length,
      blocked_room_days: (blocks.data || []).reduce(
        (sum, block) =>
          sum +
          Math.max(
            0,
            (new Date(block.released_at || block.end_date).getTime() -
              new Date(block.start_date).getTime()) /
              86_400_000,
          ),
        0,
      ),
      supplier_completion_rate: number(
        ((orders.data || []).filter(
          (order) => order.supplier_status === "completed",
        ).length /
          Math.max((orders.data || []).length, 1)) *
          100,
      ),
      aging: agingBuckets.map((bucket) => ({
        bucket: bucket.bucket,
        count: open.filter((item) => {
          const days = (now - new Date(item.created_at).getTime()) / 86_400_000;
          return days > bucket.min && days <= bucket.max;
        }).length,
      })),
      series: Array.from(seriesMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({ date, ...value })),
      financial: includeFinancial
        ? {
            approved_cost: number(approvedCost),
            approved_recovery: number(approvedRecovery),
            net_result: number(approvedRecovery - approvedCost),
            currency: hotel.data.currency,
          }
        : undefined,
    };
  }

  async exportRows(
    hotelId: string,
    filters: Record<string, string | undefined>,
    includeFinancial: boolean,
  ) {
    const supabase = createServerClient();
    let query = supabase
      .from("maintenance_occurrences")
      .select(
        "id,occurrence_number,kind,priority,status,description,created_at,triaged_at,operational_resolved_at,sla_response_due_at,sla_resolution_due_at,category:category_id(name),room:room_id(room_number),location:location_id(name),plan:preventive_plan_id(name)",
      )
      .eq("hotel_id", hotelId);
    if (filters.from) query = query.gte("created_at", filters.from);
    if (filters.to)
      query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);
    if (filters.category_id)
      query = query.eq("category_id", filters.category_id);
    if (filters.priority)
      query = query.eq(
        "priority",
        filters.priority as "low" | "normal" | "high" | "critical",
      );
    if (filters.status)
      query = query.eq(
        "status",
        filters.status as
          | "reported"
          | "triaged"
          | "in_progress"
          | "awaiting_inspection"
          | "awaiting_liability"
          | "resolved"
          | "canceled",
      );
    if (filters.plan_id)
      query = query.eq("preventive_plan_id", filters.plan_id);
    if (filters.room_id) query = query.eq("room_id", filters.room_id);
    if (filters.location_id)
      query = query.eq("location_id", filters.location_id);
    if (filters.supplier_id) {
      const supplierOrders = await supabase
        .from("maintenance_work_orders")
        .select("occurrence_id")
        .eq("hotel_id", hotelId)
        .eq("supplier_id", filters.supplier_id);
      if (supplierOrders.error) throw supplierOrders.error;
      const ids = Array.from(
        new Set(
          (supplierOrders.data || []).map((order) => order.occurrence_id),
        ),
      );
      query = query.in(
        "id",
        ids.length ? ids : ["00000000-0000-0000-0000-000000000000"],
      );
    }
    const result = await query;
    if (result.error) throw result.error;
    const rows: Array<Record<string, unknown>> = (result.data || []).map(
      (item) => ({
        code: `MAN-${String(item.occurrence_number).padStart(6, "0")}`,
        kind: item.kind,
        priority: item.priority,
        status: item.status,
        category: item.category?.name,
        target: item.room?.room_number || item.location?.name,
        preventive_plan: item.plan?.name,
        description: item.description,
        created_at: item.created_at,
        triaged_at: item.triaged_at,
        operational_resolved_at: item.operational_resolved_at,
        sla_response_due_at: item.sla_response_due_at,
        sla_resolution_due_at: item.sla_resolution_due_at,
      }),
    );
    if (includeFinancial && rows.length) {
      const occurrenceIds = (result.data || []).map((item) => item.id);
      const [costs, recoveries] = await Promise.all([
        createServerClient()
          .from("maintenance_cost_items")
          .select("occurrence_id,actual_amount")
          .eq("hotel_id", hotelId)
          .eq("approval_status", "approved")
          .in("occurrence_id", occurrenceIds),
        createServerClient()
          .from("maintenance_recoveries")
          .select("occurrence_id,charge_amount")
          .eq("hotel_id", hotelId)
          .eq("approval_status", "approved")
          .in("occurrence_id", occurrenceIds),
      ]);
      rows.forEach((row, index) => {
        const id = result.data?.[index]?.id;
        if (!id) return;
        row.approved_cost = number(
          (costs.data || [])
            .filter((item) => item.occurrence_id === id)
            .reduce((sum, item) => sum + number(item.actual_amount), 0),
        );
        row.approved_recovery = number(
          (recoveries.data || [])
            .filter((item) => item.occurrence_id === id)
            .reduce((sum, item) => sum + number(item.charge_amount), 0),
        );
      });
    }
    return rows;
  }

  async listAutomationRuns(hotelId: string) {
    const result = await createServerClient()
      .from("maintenance_automation_runs")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("started_at", { ascending: false })
      .limit(100);
    if (result.error) throw result.error;
    return (result.data || []).map((row) => ({
      id: row.id,
      run_key: row.run_key,
      status: row.status,
      trigger_kind: row.trigger_kind,
      local_date: row.local_date,
      started_at: row.started_at,
      finished_at: row.finished_at,
      duration_ms: row.duration_ms,
      counters: (row.counters || {}) as Record<string, unknown>,
      error_message: row.error_message,
    })) as AdminMaintenanceAutomationRun[];
  }

  async runAutomation(hotelId: string) {
    const result = await createServerClient().rpc(
      "process_maintenance_management_cycle",
      { p_now: new Date().toISOString(), p_hotel_id: hotelId, p_force: true },
    );
    if (result.error) throw result.error;
    return result.data;
  }

  async createDocumentUploadIntent(
    hotelId: string,
    targetType: "supplier" | "contract",
    targetId: string,
    filename: string,
  ) {
    const extension = filename.includes(".")
      ? filename
          .slice(filename.lastIndexOf("."))
          .toLowerCase()
          .replace(/[^.a-z0-9]/g, "")
      : "";
    const path = `${hotelId}/${targetType}/${targetId}/${crypto.randomUUID()}${extension}`;
    const result = await createServerClient()
      .storage.from("maintenance-management-documents")
      .createSignedUploadUrl(path);
    if (result.error || !result.data)
      throw result.error || new Error("Upload intent was not created");
    return {
      storage_path: path,
      token: result.data.token,
      signed_url: result.data.signedUrl,
    };
  }

  async finalizeDocuments(
    hotelId: string,
    actorId: string,
    targetType: "supplier" | "contract",
    targetId: string,
    files: Array<Record<string, unknown>>,
  ) {
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]);
    if (
      !files.length ||
      files.length > 5 ||
      files.some(
        (file) =>
          !String(file.storage_path || "").startsWith(
            `${hotelId}/${targetType}/${targetId}/`,
          ) ||
          !allowed.has(String(file.content_type)) ||
          number(file.size_bytes) <= 0 ||
          number(file.size_bytes) > 10_485_760,
      )
    )
      return false;
    const countQuery = createServerClient()
      .from("maintenance_management_attachments")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .is("removed_at", null);
    const count =
      targetType === "supplier"
        ? await countQuery.eq("supplier_id", targetId)
        : await countQuery.eq("contract_id", targetId);
    if (count.error || (count.count || 0) + files.length > 20) return false;
    const target =
      targetType === "supplier"
        ? await createServerClient()
            .from("maintenance_suppliers")
            .select("id")
            .eq("hotel_id", hotelId)
            .eq("id", targetId)
            .maybeSingle()
        : await createServerClient()
            .from("maintenance_contracts")
            .select("id")
            .eq("hotel_id", hotelId)
            .eq("id", targetId)
            .maybeSingle();
    if (target.error || !target.data) return false;
    const result = await createServerClient()
      .from("maintenance_management_attachments")
      .insert(
        files.map((file) => ({
          hotel_id: hotelId,
          supplier_id: targetType === "supplier" ? targetId : null,
          contract_id: targetType === "contract" ? targetId : null,
          storage_path: String(file.storage_path),
          original_filename: String(file.filename),
          content_type: String(file.content_type),
          size_bytes: number(file.size_bytes),
          uploaded_by: actorId,
        })),
      );
    return !result.error;
  }

  async accessDocument(hotelId: string, id: string) {
    const attachment = await createServerClient()
      .from("maintenance_management_attachments")
      .select("storage_path")
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .is("removed_at", null)
      .maybeSingle();
    if (attachment.error || !attachment.data) return null;
    const signed = await createServerClient()
      .storage.from("maintenance-management-documents")
      .createSignedUrl(attachment.data.storage_path, 300);
    return signed.error || !signed.data
      ? null
      : { signed_url: signed.data.signedUrl, expires_in: 300 };
  }

  async removeDocument(
    hotelId: string,
    actorId: string,
    id: string,
    reason: string,
  ) {
    const result = await createServerClient()
      .from("maintenance_management_attachments")
      .update({
        removed_at: new Date().toISOString(),
        removed_by: actorId,
        removal_reason: reason,
      })
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .is("removed_at", null)
      .select("id")
      .maybeSingle();
    return !result.error && Boolean(result.data);
  }
}

export function createMaintenanceManagementRepository(): MaintenanceManagementRepository {
  return new SupabaseMaintenanceManagementRepository();
}
