import type {
  AdminMaintenanceAttachment,
  AdminMaintenanceCategory,
  AdminMaintenanceEvent,
  AdminMaintenanceInspection,
  AdminMaintenanceLocation,
  AdminMaintenanceOccurrenceCreateInput,
  AdminMaintenanceOccurrenceDetail,
  AdminMaintenanceOccurrenceListResponse,
  AdminMaintenanceOccurrenceSummary,
  AdminMaintenanceReferenceData,
  AdminMaintenanceRoomBlock,
  AdminMaintenanceSummary,
  AdminMaintenanceWorkOrder,
  MaintenancePriority,
  MaintenanceWaitingReason,
  Json,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

const OCCURRENCE_SELECT =
  "id,occurrence_number,hotel_id,category_id,room_id,location_id,stay_id,kind,priority,status,description,discovered_at,reported_by,blocking_recommended,triaged_by,triaged_at,liability_status,suspected_party,confirmed_party,liability_notes,duplicate_of_id,canceled_reason,resolved_at,created_at,updated_at,category:category_id(name),room:room_id(room_number),location:location_id(name),reporter:reported_by(name),maintenance_work_orders(id,status,due_at),room_blocks(id,released_at)";

type OccurrenceRow = Record<string, any>;
type WorkOrderRow = Record<string, any>;

export type MaintenanceListFilters = {
  page: number;
  pageSize: number;
  status?: string;
  priority?: string;
  categoryId?: string;
  roomId?: string;
  locationId?: string;
  assignedTo?: string;
  unassigned?: boolean;
  overdue?: boolean;
  blocked?: boolean;
  search?: string;
};

export type MaintenanceWriteResult<T> =
  { result: "ok"; item: T } | { result: "not-found" | "conflict" };

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function occurrenceCode(number: number): string {
  return `OCO-${String(number).padStart(6, "0")}`;
}

function mapOccurrenceSummary(
  row: OccurrenceRow,
): AdminMaintenanceOccurrenceSummary {
  const workOrders = (row.maintenance_work_orders || []) as Array<{
    status?: string;
  }>;
  const blocks = (row.room_blocks || []) as Array<{
    released_at?: string | null;
  }>;
  const number = Number(row.occurrence_number || 0);
  return {
    id: String(row.id),
    occurrence_number: number,
    code: occurrenceCode(number),
    kind: row.kind,
    priority: row.priority,
    status: row.status,
    description: String(row.description || ""),
    category_id: String(row.category_id),
    category_name: String(relation(row.category)?.name || ""),
    room_id: row.room_id ? String(row.room_id) : null,
    room_number: relation(row.room)?.room_number
      ? String(relation(row.room)?.room_number)
      : null,
    location_id: row.location_id ? String(row.location_id) : null,
    location_name: relation(row.location)?.name
      ? String(relation(row.location)?.name)
      : null,
    stay_id: row.stay_id ? String(row.stay_id) : null,
    reported_by: String(row.reported_by),
    reporter_name: String(relation(row.reporter)?.name || ""),
    blocking_recommended: Boolean(row.blocking_recommended),
    liability_status: row.liability_status,
    active_block: blocks.some((block) => !block.released_at),
    open_work_orders: workOrders.filter(
      (order) => order.status !== "completed" && order.status !== "canceled",
    ).length,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapWorkOrder(row: WorkOrderRow): AdminMaintenanceWorkOrder {
  return {
    id: String(row.id),
    occurrence_id: String(row.occurrence_id),
    title: String(row.title),
    instructions: String(row.instructions),
    priority: row.priority,
    status: row.status,
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
    assignee_name: relation(row.assignee)?.name
      ? String(relation(row.assignee)?.name)
      : null,
    due_at: row.due_at ? String(row.due_at) : null,
    waiting_reason: row.waiting_reason || null,
    waiting_notes: row.waiting_notes ? String(row.waiting_notes) : null,
    requires_inspection: Boolean(row.requires_inspection),
    diagnosis: row.diagnosis ? String(row.diagnosis) : null,
    resolution_notes: row.resolution_notes
      ? String(row.resolution_notes)
      : null,
    started_at: row.started_at ? String(row.started_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export interface MaintenanceRepository {
  listOccurrences(
    hotelId: string,
    filters: MaintenanceListFilters,
    viewerId?: string,
  ): Promise<AdminMaintenanceOccurrenceListResponse>;
  getStayMaintenance(
    hotelId: string,
    stayId: string,
  ): Promise<{
    occurrences: AdminMaintenanceOccurrenceSummary[];
    acknowledgementRequired: boolean;
  }>;
  getOccurrence(
    hotelId: string,
    id: string,
  ): Promise<AdminMaintenanceOccurrenceDetail | null>;
  getWorkOrderAccess(
    hotelId: string,
    id: string,
  ): Promise<{ assignedTo: string | null; occurrenceId: string } | null>;
  createOccurrence(
    hotelId: string,
    actorId: string,
    payload: AdminMaintenanceOccurrenceCreateInput,
  ): Promise<AdminMaintenanceOccurrenceDetail>;
  updateOccurrence(
    hotelId: string,
    id: string,
    payload: Record<string, unknown>,
    actorId: string,
    eventType: string,
    message?: string | null,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>>;
  addComment(
    hotelId: string,
    id: string,
    actorId: string,
    message: string,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>>;
  createWorkOrder(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    payload: Record<string, unknown>,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>>;
  transitionWorkOrder(
    hotelId: string,
    orderId: string,
    actorId: string,
    payload: Record<string, unknown>,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>>;
  inspectWorkOrder(
    hotelId: string,
    orderId: string,
    actorId: string,
    result: "approved" | "rejected",
    notes: string,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>>;
  createRoomBlock(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    payload: {
      start_date: string;
      end_date: string;
      status: "blocked" | "maintenance";
      label?: string | null;
      conflict_acknowledgement?: string | null;
    },
  ): Promise<
    | { result: "ok"; item: AdminMaintenanceOccurrenceDetail }
    | { result: "not-found" }
    | {
        result: "conflict";
        conflicts?: Array<{
          id: string;
          reservation_code: string | null;
          checkin_date_expected: string;
          checkout_date_expected: string;
        }>;
      }
  >;
  releaseRoomBlock(
    hotelId: string,
    blockId: string,
    actorId: string,
    reason: string,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>>;
  listCategories(hotelId: string): Promise<AdminMaintenanceCategory[]>;
  writeCategory(
    hotelId: string,
    id: string | null,
    payload: Record<string, unknown>,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceCategory>>;
  listLocations(hotelId: string): Promise<AdminMaintenanceLocation[]>;
  writeLocation(
    hotelId: string,
    id: string | null,
    payload: Record<string, unknown>,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceLocation>>;
  getReferenceData(hotelId: string): Promise<AdminMaintenanceReferenceData>;
  getSummary(
    hotelId: string,
    actorId: string,
  ): Promise<AdminMaintenanceSummary>;
  countAttachments(hotelId: string, occurrenceId: string): Promise<number>;
  createUploadIntent(
    hotelId: string,
    occurrenceId: string,
    filename: string,
  ): Promise<{ storage_path: string; token: string; signed_url: string }>;
  finalizeAttachments(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    files: Array<Record<string, unknown>>,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>>;
  createAttachmentAccess(
    hotelId: string,
    attachmentId: string,
  ): Promise<{ signed_url: string; expires_in: number } | null>;
  getAttachmentOccurrenceId(
    hotelId: string,
    attachmentId: string,
  ): Promise<string | null>;
  removeAttachment(
    hotelId: string,
    attachmentId: string,
    actorId: string,
    reason: string,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>>;
}

class SupabaseMaintenanceRepository implements MaintenanceRepository {
  async listOccurrences(
    hotelId: string,
    filters: MaintenanceListFilters,
    viewerId?: string,
  ): Promise<AdminMaintenanceOccurrenceListResponse> {
    const supabase = createServerClient();
    let query: any = supabase
      .from("maintenance_occurrences")
      .select(OCCURRENCE_SELECT, { count: "exact" })
      .eq("hotel_id", hotelId);
    if (viewerId) {
      const { data: assignedOrders, error: assignedError } = await supabase
        .from("maintenance_work_orders")
        .select("occurrence_id")
        .eq("hotel_id", hotelId)
        .eq("assigned_to", viewerId);
      if (assignedError) throw assignedError;
      const assignedIds = Array.from(
        new Set(
          (assignedOrders || []).map((order) => String(order.occurrence_id)),
        ),
      );
      query = assignedIds.length
        ? query.or(
            `reported_by.eq.${viewerId},id.in.(${assignedIds.join(",")})`,
          )
        : query.eq("reported_by", viewerId);
    }
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.priority) query = query.eq("priority", filters.priority);
    if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
    if (filters.roomId) query = query.eq("room_id", filters.roomId);
    if (filters.locationId) query = query.eq("location_id", filters.locationId);
    if (filters.search)
      query = query.ilike("description", `%${filters.search}%`);
    if (filters.assignedTo)
      query = query.eq(
        "maintenance_work_orders.assigned_to",
        filters.assignedTo,
      );
    if (filters.unassigned)
      query = query.is("maintenance_work_orders.assigned_to", null);
    const from = (filters.page - 1) * filters.pageSize;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, from + filters.pageSize - 1);
    if (error) throw error;
    let rows = (data || []) as OccurrenceRow[];
    if (filters.overdue)
      rows = rows.filter((row) =>
        (row.maintenance_work_orders || []).some(
          (order: { status?: string; due_at?: string | null }) =>
            order.due_at &&
            order.due_at < new Date().toISOString() &&
            order.status !== "completed" &&
            order.status !== "canceled",
        ),
      );
    let items = rows.map(mapOccurrenceSummary);
    if (filters.blocked !== undefined)
      items = items.filter((item) => item.active_block === filters.blocked);
    return {
      items,
      page: filters.page,
      page_size: filters.pageSize,
      total: Number(count || 0),
    };
  }

  async getStayMaintenance(
    hotelId: string,
    stayId: string,
  ): Promise<{
    occurrences: AdminMaintenanceOccurrenceSummary[];
    acknowledgementRequired: boolean;
  }> {
    const supabase = createServerClient();
    const [occurrencesResult, acknowledgementsResult] = await Promise.all([
      supabase
        .from("maintenance_occurrences")
        .select(OCCURRENCE_SELECT)
        .eq("hotel_id", hotelId)
        .eq("stay_id", stayId)
        .order("created_at", { ascending: false }),
      supabase
        .from("maintenance_checkout_acknowledgements")
        .select("occurrence_id")
        .eq("hotel_id", hotelId)
        .eq("stay_id", stayId),
    ]);
    if (occurrencesResult.error || acknowledgementsResult.error)
      throw occurrencesResult.error || acknowledgementsResult.error;
    const occurrences = ((occurrencesResult.data || []) as OccurrenceRow[]).map(
      mapOccurrenceSummary,
    );
    const acknowledgedIds = new Set(
      (acknowledgementsResult.data || []).map((row) =>
        String(row.occurrence_id),
      ),
    );
    const acknowledgementRequired = occurrences.some(
      (occurrence) =>
        occurrence.status !== "resolved" &&
        occurrence.status !== "canceled" &&
        !acknowledgedIds.has(occurrence.id),
    );
    return { occurrences, acknowledgementRequired };
  }

  async getOccurrence(
    hotelId: string,
    id: string,
  ): Promise<AdminMaintenanceOccurrenceDetail | null> {
    const supabase = createServerClient();
    const occurrenceResult = await supabase
      .from("maintenance_occurrences")
      .select(OCCURRENCE_SELECT)
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .single();
    if (occurrenceResult.error || !occurrenceResult.data) return null;
    const orderIds = (
      (occurrenceResult.data as OccurrenceRow).maintenance_work_orders || []
    ).map((item: { id: string }) => item.id);
    const [
      ordersResult,
      inspectionsResult,
      eventsResult,
      attachmentsResult,
      blocksResult,
    ] = await Promise.all([
      supabase
        .from("maintenance_work_orders")
        .select(
          "id,occurrence_id,title,instructions,priority,status,assigned_to,due_at,waiting_reason,waiting_notes,requires_inspection,diagnosis,resolution_notes,started_at,completed_at,created_at,updated_at,assignee:assigned_to(name)",
        )
        .eq("hotel_id", hotelId)
        .eq("occurrence_id", id)
        .order("created_at"),
      supabase
        .from("maintenance_inspections")
        .select(
          "id,work_order_id,inspector_id,result,notes,created_at,inspector:inspector_id(name)",
        )
        .eq("hotel_id", hotelId)
        .in(
          "work_order_id",
          orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"],
        ),
      supabase
        .from("maintenance_events")
        .select(
          "id,occurrence_id,work_order_id,actor_id,event_type,message,metadata,created_at,actor:actor_id(name)",
        )
        .eq("hotel_id", hotelId)
        .eq("occurrence_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("maintenance_attachments")
        .select(
          "id,occurrence_id,work_order_id,original_filename,content_type,size_bytes,uploaded_by,created_at",
        )
        .eq("hotel_id", hotelId)
        .eq("occurrence_id", id)
        .is("removed_at", null)
        .order("created_at"),
      supabase
        .from("room_blocks")
        .select(
          "id,maintenance_occurrence_id,room_id,status,label,start_date,end_date,released_at,room:room_id(room_number)",
        )
        .eq("hotel_id", hotelId)
        .eq("maintenance_occurrence_id", id)
        .order("start_date", { ascending: false }),
    ]);
    if (
      ordersResult.error ||
      inspectionsResult.error ||
      eventsResult.error ||
      attachmentsResult.error ||
      blocksResult.error
    )
      throw (
        ordersResult.error ||
        inspectionsResult.error ||
        eventsResult.error ||
        attachmentsResult.error ||
        blocksResult.error
      );
    const row = occurrenceResult.data as OccurrenceRow;
    const summary = mapOccurrenceSummary(row);
    return {
      ...summary,
      discovered_at: String(row.discovered_at),
      triaged_by: row.triaged_by ? String(row.triaged_by) : null,
      triaged_at: row.triaged_at ? String(row.triaged_at) : null,
      suspected_party: row.suspected_party || null,
      confirmed_party: row.confirmed_party || null,
      liability_notes: row.liability_notes ? String(row.liability_notes) : null,
      duplicate_of_id: row.duplicate_of_id ? String(row.duplicate_of_id) : null,
      canceled_reason: row.canceled_reason ? String(row.canceled_reason) : null,
      resolved_at: row.resolved_at ? String(row.resolved_at) : null,
      work_orders: ((ordersResult.data || []) as WorkOrderRow[]).map(
        mapWorkOrder,
      ),
      inspections: ((inspectionsResult.data || []) as any[]).map((item) => ({
        id: String(item.id),
        work_order_id: String(item.work_order_id),
        inspector_id: String(item.inspector_id),
        inspector_name: String(relation(item.inspector)?.name || ""),
        result: item.result,
        notes: String(item.notes),
        created_at: String(item.created_at),
      })) as AdminMaintenanceInspection[],
      events: ((eventsResult.data || []) as any[]).map((item) => ({
        id: String(item.id),
        occurrence_id: String(item.occurrence_id),
        work_order_id: item.work_order_id ? String(item.work_order_id) : null,
        actor_id: String(item.actor_id),
        actor_name: String(relation(item.actor)?.name || ""),
        event_type: String(item.event_type),
        message: item.message ? String(item.message) : null,
        metadata: (item.metadata || {}) as Record<string, unknown>,
        created_at: String(item.created_at),
      })) as AdminMaintenanceEvent[],
      attachments: ((attachmentsResult.data || []) as any[]).map((item) => ({
        ...item,
        id: String(item.id),
        occurrence_id: String(item.occurrence_id),
        work_order_id: item.work_order_id ? String(item.work_order_id) : null,
        original_filename: String(item.original_filename),
        content_type: item.content_type,
        size_bytes: Number(item.size_bytes),
        uploaded_by: String(item.uploaded_by),
        created_at: String(item.created_at),
      })) as AdminMaintenanceAttachment[],
      room_blocks: ((blocksResult.data || []) as any[]).map((item) => ({
        id: String(item.id),
        occurrence_id: item.maintenance_occurrence_id
          ? String(item.maintenance_occurrence_id)
          : null,
        room_id: String(item.room_id),
        room_number: String(relation(item.room)?.room_number || ""),
        status: item.status,
        label: item.label ? String(item.label) : null,
        start_date: String(item.start_date),
        planned_end_date: String(item.end_date),
        released_at: item.released_at ? String(item.released_at) : null,
        is_overdue:
          !item.released_at &&
          String(item.end_date) < new Date().toISOString().slice(0, 10),
      })) as AdminMaintenanceRoomBlock[],
    };
  }

  async getWorkOrderAccess(
    hotelId: string,
    id: string,
  ): Promise<{ assignedTo: string | null; occurrenceId: string } | null> {
    const { data, error } = await createServerClient()
      .from("maintenance_work_orders")
      .select("assigned_to,occurrence_id")
      .eq("hotel_id", hotelId)
      .eq("id", id)
      .single();
    return error || !data
      ? null
      : {
          assignedTo: data.assigned_to ? String(data.assigned_to) : null,
          occurrenceId: String(data.occurrence_id),
        };
  }

  async createOccurrence(
    hotelId: string,
    actorId: string,
    payload: AdminMaintenanceOccurrenceCreateInput,
  ): Promise<AdminMaintenanceOccurrenceDetail> {
    const supabase = createServerClient();
    const { data: id, error } = await supabase.rpc(
      "create_maintenance_occurrence",
      {
        p_hotel_id: hotelId,
        p_category_id: payload.category_id,
        p_kind: payload.kind,
        p_priority: payload.priority || "normal",
        p_description: payload.description.trim(),
        p_discovered_at: payload.discovered_at || new Date().toISOString(),
        p_reported_by: actorId,
        p_blocking_recommended: payload.blocking_recommended || false,
        ...(payload.room_id ? { p_room_id: payload.room_id } : {}),
        ...(payload.location_id ? { p_location_id: payload.location_id } : {}),
        ...(payload.stay_id ? { p_stay_id: payload.stay_id } : {}),
      },
    );
    if (error || !id) throw error || new Error("Occurrence was not created");
    return (await this.getOccurrence(hotelId, id))!;
  }

  private async addEvent(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    eventType: string,
    message?: string | null,
    workOrderId?: string | null,
    metadata: Json = {},
  ): Promise<void> {
    const { error } = await createServerClient()
      .from("maintenance_events")
      .insert({
        hotel_id: hotelId,
        occurrence_id: occurrenceId,
        work_order_id: workOrderId || null,
        actor_id: actorId,
        event_type: eventType,
        message: message || null,
        metadata,
      });
    if (error) throw error;
  }

  async updateOccurrence(
    hotelId: string,
    id: string,
    payload: Record<string, unknown>,
    actorId: string,
    eventType: string,
    message?: string | null,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>> {
    const supabase = createServerClient();
    const { data, error } = await supabase.rpc(
      "apply_maintenance_occurrence_change",
      {
        p_hotel_id: hotelId,
        p_occurrence_id: id,
        p_actor_id: actorId,
        p_patch: payload as Json,
        p_event_type: eventType,
        p_message: message || undefined,
      },
    );
    if (error) return { result: "conflict" };
    if (!data) return { result: "not-found" };
    return { result: "ok", item: (await this.getOccurrence(hotelId, id))! };
  }

  async addComment(
    hotelId: string,
    id: string,
    actorId: string,
    message: string,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>> {
    if (!(await this.getOccurrence(hotelId, id)))
      return { result: "not-found" };
    await this.addEvent(hotelId, id, actorId, "comment_added", message);
    return { result: "ok", item: (await this.getOccurrence(hotelId, id))! };
  }

  async createWorkOrder(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    payload: Record<string, unknown>,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>> {
    const occurrence = await this.getOccurrence(hotelId, occurrenceId);
    if (!occurrence) return { result: "not-found" };
    const assignedTo = payload.assigned_to ? String(payload.assigned_to) : null;
    const { data, error } = await createServerClient().rpc(
      "create_maintenance_work_order",
      {
        p_hotel_id: hotelId,
        p_occurrence_id: occurrenceId,
        p_actor_id: actorId,
        p_title: String(payload.title),
        p_instructions: String(payload.instructions),
        p_priority:
          (payload.priority as MaintenancePriority | undefined) ||
          occurrence.priority,
        p_requires_inspection: Boolean(payload.requires_inspection),
        ...(assignedTo ? { p_assigned_to: assignedTo } : {}),
        ...(payload.due_at ? { p_due_at: String(payload.due_at) } : {}),
      },
    );
    if (error || !data) return { result: "conflict" };
    return {
      result: "ok",
      item: (await this.getOccurrence(hotelId, occurrenceId))!,
    };
  }

  async transitionWorkOrder(
    hotelId: string,
    orderId: string,
    actorId: string,
    payload: Record<string, unknown>,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>> {
    const supabase = createServerClient();
    const { data: occurrenceId, error } = await supabase.rpc(
      "transition_maintenance_work_order",
      {
        p_hotel_id: hotelId,
        p_work_order_id: orderId,
        p_actor_id: actorId,
        p_action: String(payload.action || ""),
        p_assigned_to: payload.assigned_to
          ? String(payload.assigned_to)
          : undefined,
        p_waiting_reason: payload.waiting_reason as
          MaintenanceWaitingReason | undefined,
        p_notes: payload.notes ? String(payload.notes) : undefined,
        p_diagnosis: payload.diagnosis ? String(payload.diagnosis) : undefined,
      },
    );
    if (error) return { result: "conflict" };
    if (!occurrenceId) return { result: "not-found" };
    return {
      result: "ok",
      item: (await this.getOccurrence(hotelId, occurrenceId))!,
    };
  }

  async inspectWorkOrder(
    hotelId: string,
    orderId: string,
    actorId: string,
    result: "approved" | "rejected",
    notes: string,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>> {
    const supabase = createServerClient();
    const { data: occurrenceId, error } = await supabase.rpc(
      "inspect_maintenance_work_order",
      {
        p_hotel_id: hotelId,
        p_work_order_id: orderId,
        p_actor_id: actorId,
        p_result: result,
        p_notes: notes,
      },
    );
    if (error) return { result: "conflict" };
    if (!occurrenceId) return { result: "not-found" };
    return {
      result: "ok",
      item: (await this.getOccurrence(hotelId, occurrenceId))!,
    };
  }

  async createRoomBlock(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    payload: {
      start_date: string;
      end_date: string;
      status: "blocked" | "maintenance";
      label?: string | null;
      conflict_acknowledgement?: string | null;
    },
  ) {
    const supabase = createServerClient();
    const occurrence = await this.getOccurrence(hotelId, occurrenceId);
    if (!occurrence || !occurrence.room_id)
      return { result: "not-found" as const };
    const conflictsResult = await supabase
      .from("stays")
      .select(
        "id,checkin_date_expected,checkout_date_expected,reservations:reservation_id(reservation_code)",
      )
      .eq("room_id", occurrence.room_id)
      .lt("checkin_date_expected", `${payload.end_date}T23:59:59.999Z`)
      .gt("checkout_date_expected", `${payload.start_date}T00:00:00.000Z`)
      .not("stay_status", "in", "(canceled,no_show)");
    if (conflictsResult.error) throw conflictsResult.error;
    const conflicts = ((conflictsResult.data || []) as any[]).map((item) => ({
      id: String(item.id),
      reservation_code: relation(item.reservations)?.reservation_code || null,
      checkin_date_expected: String(item.checkin_date_expected),
      checkout_date_expected: String(item.checkout_date_expected),
    }));
    if (conflicts.length && !payload.conflict_acknowledgement)
      return { result: "conflict" as const, conflicts };
    const { data: blockId, error } = await supabase.rpc(
      "create_maintenance_room_block",
      {
        p_hotel_id: hotelId,
        p_occurrence_id: occurrenceId,
        p_actor_id: actorId,
        p_start_date: payload.start_date,
        p_end_date: payload.end_date,
        p_status: payload.status,
        p_label: payload.label || undefined,
        p_conflict_acknowledgement:
          payload.conflict_acknowledgement || undefined,
      },
    );
    if (error || !blockId) return { result: "conflict" as const };
    return {
      result: "ok" as const,
      item: (await this.getOccurrence(hotelId, occurrenceId))!,
    };
  }

  async releaseRoomBlock(
    hotelId: string,
    blockId: string,
    actorId: string,
    reason: string,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>> {
    const supabase = createServerClient();
    const { data: occurrenceId, error } = await supabase.rpc(
      "release_maintenance_room_block",
      {
        p_hotel_id: hotelId,
        p_block_id: blockId,
        p_actor_id: actorId,
        p_reason: reason,
      },
    );
    if (error) return { result: "conflict" };
    if (!occurrenceId) return { result: "not-found" };
    return {
      result: "ok",
      item: (await this.getOccurrence(hotelId, occurrenceId))!,
    };
  }

  async listCategories(hotelId: string): Promise<AdminMaintenanceCategory[]> {
    const { data, error } = await createServerClient()
      .from("maintenance_categories")
      .select(
        "id,hotel_id,name,description,display_order,is_active,created_at,updated_at",
      )
      .eq("hotel_id", hotelId)
      .order("display_order")
      .order("name");
    if (error) throw error;
    return (data || []) as AdminMaintenanceCategory[];
  }
  async writeCategory(
    hotelId: string,
    id: string | null,
    payload: Record<string, unknown>,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceCategory>> {
    const supabase = createServerClient();
    const query = id
      ? supabase
          .from("maintenance_categories")
          .update(payload as any)
          .eq("hotel_id", hotelId)
          .eq("id", id)
      : supabase
          .from("maintenance_categories")
          .insert({ ...payload, hotel_id: hotelId } as any);
    const { data, error } = await query
      .select(
        "id,hotel_id,name,description,display_order,is_active,created_at,updated_at",
      )
      .single();
    if (error || !data) return { result: id ? "not-found" : "conflict" };
    return { result: "ok", item: data as AdminMaintenanceCategory };
  }
  async listLocations(hotelId: string): Promise<AdminMaintenanceLocation[]> {
    const { data, error } = await createServerClient()
      .from("maintenance_locations")
      .select(
        "id,hotel_id,parent_location_id,kind,name,description,display_order,is_active,created_at,updated_at,parent:parent_location_id(name)",
      )
      .eq("hotel_id", hotelId)
      .order("display_order")
      .order("name");
    if (error) throw error;
    return ((data || []) as any[]).map((item) => ({
      ...item,
      parent_name: relation(item.parent)?.name || null,
    })) as AdminMaintenanceLocation[];
  }
  async writeLocation(
    hotelId: string,
    id: string | null,
    payload: Record<string, unknown>,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceLocation>> {
    const supabase = createServerClient();
    const query = id
      ? supabase
          .from("maintenance_locations")
          .update(payload as any)
          .eq("hotel_id", hotelId)
          .eq("id", id)
      : supabase
          .from("maintenance_locations")
          .insert({ ...payload, hotel_id: hotelId } as any);
    const { data, error } = await query.select("id").single();
    if (error || !data) return { result: id ? "not-found" : "conflict" };
    const item = (await this.listLocations(hotelId)).find(
      (candidate) => candidate.id === String(data.id),
    );
    return item ? { result: "ok", item } : { result: "not-found" };
  }

  async getReferenceData(
    hotelId: string,
  ): Promise<AdminMaintenanceReferenceData> {
    const supabase = createServerClient();
    const [categories, locations, roomsResult, usersResult, staysResult] =
      await Promise.all([
        this.listCategories(hotelId),
        this.listLocations(hotelId),
        supabase
          .from("rooms")
          .select("id,room_number,room_type")
          .eq("hotel_id", hotelId)
          .order("room_number"),
        supabase
          .from("user_roles")
          .select("users:user_id(id,name,is_active)")
          .eq("hotel_id", hotelId),
        supabase
          .from("stays")
          .select(
            "id,room_id,stay_status,reservations:reservation_id(reservation_code,hotel_id,customers:booking_customer_id(full_name)),rooms:room_id(hotel_id)",
          )
          .in("stay_status", ["confirmed", "checked_in"]),
      ]);
    if (roomsResult.error || usersResult.error || staysResult.error)
      throw roomsResult.error || usersResult.error || staysResult.error;
    const users = ((usersResult.data || []) as any[])
      .map((item) => relation(item.users))
      .filter((item) => item?.is_active)
      .map((item) => ({ id: String(item.id), name: String(item.name) }));
    const stays = ((staysResult.data || []) as any[])
      .filter(
        (item) =>
          relation(item.rooms)?.hotel_id === hotelId &&
          relation(item.reservations)?.hotel_id === hotelId,
      )
      .map((item) => ({
        id: String(item.id),
        room_id: String(item.room_id),
        reservation_code: relation(item.reservations)?.reservation_code || null,
        customer_name:
          relation(relation(item.reservations)?.customers)?.full_name || null,
        status: item.stay_status,
      }));
    return {
      categories,
      locations,
      rooms: (roomsResult.data || []).map((item) => ({
        id: String(item.id),
        room_number: String(item.room_number),
        room_type: String(item.room_type),
      })),
      stays,
      assignable_users: Array.from(
        new Map(users.map((item) => [item.id, item])).values(),
      ),
    };
  }

  async getSummary(
    hotelId: string,
    actorId: string,
  ): Promise<AdminMaintenanceSummary> {
    const supabase = createServerClient();
    const [occurrencesResult, ordersResult, blocksResult] = await Promise.all([
      supabase
        .from("maintenance_occurrences")
        .select("id,status")
        .eq("hotel_id", hotelId)
        .not("status", "in", "(resolved,canceled)"),
      supabase
        .from("maintenance_work_orders")
        .select("id,status,assigned_to,due_at")
        .eq("hotel_id", hotelId)
        .not("status", "in", "(completed,canceled)"),
      supabase
        .from("room_blocks")
        .select("id")
        .eq("hotel_id", hotelId)
        .is("released_at", null),
    ]);
    if (occurrencesResult.error || ordersResult.error || blocksResult.error)
      throw occurrencesResult.error || ordersResult.error || blocksResult.error;
    const orders = (ordersResult.data || []) as any[];
    const now = new Date().toISOString();
    return {
      open: (occurrencesResult.data || []).length,
      assigned_to_me: orders.filter((item) => item.assigned_to === actorId)
        .length,
      unassigned: orders.filter((item) => !item.assigned_to).length,
      overdue: orders.filter((item) => item.due_at && item.due_at < now).length,
      awaiting_inspection: orders.filter(
        (item) => item.status === "awaiting_inspection",
      ).length,
      blocked_rooms: (blocksResult.data || []).length,
    };
  }

  async countAttachments(
    hotelId: string,
    occurrenceId: string,
  ): Promise<number> {
    const { count, error } = await createServerClient()
      .from("maintenance_attachments")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("occurrence_id", occurrenceId)
      .is("removed_at", null);
    if (error) throw error;
    return Number(count || 0);
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
      .storage.from("maintenance-evidence")
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
    files: Array<Record<string, unknown>>,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>> {
    if (!(await this.getOccurrence(hotelId, occurrenceId)))
      return { result: "not-found" };
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (
      !files.length ||
      files.length > 5 ||
      (await this.countAttachments(hotelId, occurrenceId)) + files.length >
        20 ||
      files.some(
        (file) =>
          !String(file.storage_path || "").startsWith(
            `${hotelId}/${occurrenceId}/`,
          ) ||
          !allowedTypes.has(String(file.content_type)) ||
          Number(file.size_bytes) <= 0 ||
          Number(file.size_bytes) > 10485760,
      )
    )
      return { result: "conflict" };
    const bucket = createServerClient().storage.from("maintenance-evidence");
    const verified = await Promise.all(
      files.map(async (file) => {
        const storagePath = String(file.storage_path);
        const filename = storagePath.slice(storagePath.lastIndexOf("/") + 1);
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
    if (verified.some((valid) => !valid)) return { result: "conflict" };
    const rows = files.map((file) => ({
      hotel_id: hotelId,
      occurrence_id: occurrenceId,
      work_order_id: file.work_order_id || null,
      storage_path: file.storage_path,
      original_filename: file.filename,
      content_type: file.content_type,
      size_bytes: file.size_bytes,
      uploaded_by: actorId,
    }));
    const { error } = await createServerClient()
      .from("maintenance_attachments")
      .insert(rows as any);
    if (error) return { result: "conflict" };
    await this.addEvent(
      hotelId,
      occurrenceId,
      actorId,
      "attachments_added",
      `${files.length} foto(s) adicionada(s).`,
      null,
      { count: files.length },
    );
    return {
      result: "ok",
      item: (await this.getOccurrence(hotelId, occurrenceId))!,
    };
  }
  async createAttachmentAccess(hotelId: string, attachmentId: string) {
    const { data, error } = await createServerClient()
      .from("maintenance_attachments")
      .select("storage_path")
      .eq("hotel_id", hotelId)
      .eq("id", attachmentId)
      .is("removed_at", null)
      .single();
    if (error || !data) return null;
    const signed = await createServerClient()
      .storage.from("maintenance-evidence")
      .createSignedUrl(String(data.storage_path), 300);
    if (signed.error || !signed.data) return null;
    return { signed_url: signed.data.signedUrl, expires_in: 300 };
  }
  async getAttachmentOccurrenceId(
    hotelId: string,
    attachmentId: string,
  ): Promise<string | null> {
    const { data, error } = await createServerClient()
      .from("maintenance_attachments")
      .select("occurrence_id")
      .eq("hotel_id", hotelId)
      .eq("id", attachmentId)
      .is("removed_at", null)
      .single();
    return error || !data ? null : String(data.occurrence_id);
  }
  async removeAttachment(
    hotelId: string,
    attachmentId: string,
    actorId: string,
    reason: string,
  ): Promise<MaintenanceWriteResult<AdminMaintenanceOccurrenceDetail>> {
    const supabase = createServerClient();
    const attachmentResult = await supabase
      .from("maintenance_attachments")
      .select("occurrence_id,storage_path,removed_at")
      .eq("hotel_id", hotelId)
      .eq("id", attachmentId)
      .single();
    if (attachmentResult.error || !attachmentResult.data)
      return { result: "not-found" };
    const attachment: any = attachmentResult.data;
    if (attachment.removed_at) return { result: "conflict" };
    const remove = await supabase.storage
      .from("maintenance-evidence")
      .remove([String(attachment.storage_path)]);
    if (remove.error) return { result: "conflict" };
    const update = await supabase
      .from("maintenance_attachments")
      .update({
        removed_at: new Date().toISOString(),
        removed_by: actorId,
        removal_reason: reason,
      })
      .eq("id", attachmentId)
      .eq("hotel_id", hotelId);
    if (update.error) return { result: "conflict" };
    await this.addEvent(
      hotelId,
      String(attachment.occurrence_id),
      actorId,
      "attachment_removed",
      reason,
      null,
      { attachment_id: attachmentId },
    );
    return {
      result: "ok",
      item: (await this.getOccurrence(
        hotelId,
        String(attachment.occurrence_id),
      ))!,
    };
  }
}

export function createMaintenanceRepository(): MaintenanceRepository {
  return new SupabaseMaintenanceRepository();
}
