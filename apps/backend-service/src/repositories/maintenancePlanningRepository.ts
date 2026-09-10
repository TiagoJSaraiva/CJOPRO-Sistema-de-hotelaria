import type {
  Json,
  MaintenanceAffectedRoomsInput,
  MaintenanceAvailabilityExceptionInput,
  MaintenanceLifecycleActionInput,
  MaintenanceLifecycleCreateInput,
  MaintenancePlanningBoard,
  MaintenanceRecurrenceActionInput,
  MaintenanceRecurrencePolicyInput,
  MaintenanceScheduleInput,
  MaintenanceScheduleSimulation,
  MaintenanceServiceConfirmationInput,
  MaintenanceTeamInput,
  MaintenanceWaitingFollowupInput,
} from "@hotel/shared";
import { createServerClient } from "../common/supabaseServer";

type Result<T = undefined> = { result: string; item?: T; context?: unknown };
type RpcObject = { result?: string; [key: string]: unknown };

function object(value: Json): RpcObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RpcObject)
    : { result: "failed" };
}

export interface MaintenancePlanningRepository {
  board(
    hotelId: string,
    from?: string,
    to?: string,
  ): Promise<MaintenancePlanningBoard>;
  saveTeam(
    hotelId: string,
    actorId: string,
    input: MaintenanceTeamInput,
    id?: string,
  ): Promise<Result>;
  addAvailabilityException(
    hotelId: string,
    actorId: string,
    input: MaintenanceAvailabilityExceptionInput,
  ): Promise<Result>;
  simulate(
    hotelId: string,
    orderId: string,
    input: MaintenanceScheduleInput,
  ): Promise<Result<MaintenanceScheduleSimulation>>;
  schedule(
    hotelId: string,
    orderId: string,
    actorId: string,
    input: MaintenanceScheduleInput,
    allowOverride: boolean,
  ): Promise<Result>;
  requestReschedule(
    hotelId: string,
    orderId: string,
    actorId: string,
    requestedStart: string | undefined,
    reason: string,
  ): Promise<Result>;
  decideReschedule(
    hotelId: string,
    requestId: string,
    actorId: string,
    approved: boolean,
    reason: string,
  ): Promise<Result>;
  followUp(
    hotelId: string,
    orderId: string,
    actorId: string,
    input: MaintenanceWaitingFollowupInput,
  ): Promise<Result>;
  updateAffectedRooms(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    input: MaintenanceAffectedRoomsInput,
  ): Promise<Result>;
  recurrence(
    hotelId: string,
    occurrenceId: string,
  ): Promise<Record<string, unknown>>;
  saveRecurrencePolicy(
    hotelId: string,
    actorId: string,
    input: MaintenanceRecurrencePolicyInput,
  ): Promise<Result>;
  actRecurrence(
    hotelId: string,
    groupId: string,
    actorId: string,
    input: MaintenanceRecurrenceActionInput,
  ): Promise<Result>;
  createLifecycle(
    hotelId: string,
    occurrenceId: string,
    actorId: string,
    input: MaintenanceLifecycleCreateInput,
  ): Promise<Result>;
  actLifecycle(
    hotelId: string,
    decisionId: string,
    actorId: string,
    input: MaintenanceLifecycleActionInput,
  ): Promise<Result>;
  confirmService(
    hotelId: string,
    orderId: string,
    actorId: string,
    input: MaintenanceServiceConfirmationInput,
  ): Promise<Result>;
  recordCommunication(
    hotelId: string,
    orderId: string,
    actorId: string,
    input: Record<string, unknown>,
  ): Promise<Result>;
  reconcile(hotelId: string): Promise<Result>;
}

export function createMaintenancePlanningRepository(): MaintenancePlanningRepository {
  return {
    async board(hotelId, from, to) {
      const { data, error } = await createServerClient().rpc(
        "list_maintenance_planning_board",
        {
          p_hotel_id: hotelId,
          ...(from ? { p_from: from } : {}),
          ...(to ? { p_to: to } : {}),
        },
      );
      if (error) throw error;
      return data as unknown as MaintenancePlanningBoard;
    },
    async saveTeam(hotelId, actorId, input, id) {
      const { data, error } = await createServerClient().rpc(
        "save_maintenance_team",
        {
          p_hotel_id: hotelId,
          p_actor_id: actorId,
          p_team_id: (id || null) as unknown as string,
          p_input: input as unknown as Json,
        },
      );
      if (error) throw error;
      return object(data) as Result;
    },
    async addAvailabilityException(hotelId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "create_maintenance_availability_exception",
        {
          p_hotel_id: hotelId,
          p_actor_id: actorId,
          p_input: input as unknown as Json,
        },
      );
      if (error) throw error;
      return object(data) as Result;
    },
    async simulate(hotelId, orderId, input) {
      const { data, error } = await createServerClient().rpc(
        "maintenance_schedule_conflicts",
        {
          p_hotel_id: hotelId,
          p_work_order_id: orderId,
          p_team_id: (input.team_id || null) as unknown as string,
          p_technician_id: (input.technician_id || null) as unknown as string,
          p_start: input.planned_start,
          p_minutes: input.estimated_minutes,
          p_access: input.access_kind,
        },
      );
      if (error) throw error;
      const value = object(data);
      return value.result === "ok"
        ? {
            result: "ok",
            item: value as unknown as MaintenanceScheduleSimulation,
          }
        : { result: String(value.result || "failed") };
    },
    async schedule(hotelId, orderId, actorId, input, allowOverride) {
      const { data, error } = await createServerClient().rpc(
        "schedule_maintenance_work_order",
        {
          p_hotel_id: hotelId,
          p_work_order_id: orderId,
          p_actor_id: actorId,
          p_input: input as unknown as Json,
          p_allow_override: allowOverride,
        },
      );
      if (error) throw error;
      const value = object(data);
      return {
        result: String(value.result || "failed"),
        context: value.context,
      };
    },
    async requestReschedule(hotelId, orderId, actorId, requestedStart, reason) {
      const { data, error } = await createServerClient().rpc(
        "request_maintenance_reschedule",
        {
          p_hotel_id: hotelId,
          p_work_order_id: orderId,
          p_actor_id: actorId,
          p_requested_start: (requestedStart || null) as unknown as string,
          p_reason: reason,
        },
      );
      if (error) throw error;
      return object(data) as Result;
    },
    async decideReschedule(hotelId, requestId, actorId, approved, reason) {
      const { data, error } = await createServerClient().rpc(
        "decide_maintenance_reschedule",
        {
          p_hotel_id: hotelId,
          p_request_id: requestId,
          p_actor_id: actorId,
          p_approved: approved,
          p_reason: reason,
        },
      );
      if (error) throw error;
      return object(data) as Result;
    },
    async followUp(hotelId, orderId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "follow_up_maintenance_waiting",
        {
          p_hotel_id: hotelId,
          p_work_order_id: orderId,
          p_actor_id: actorId,
          p_notes: input.notes,
          p_next: input.next_follow_up_at,
          p_expected_version: input.expected_version,
        },
      );
      if (error) throw error;
      return object(data) as Result;
    },
    async updateAffectedRooms(hotelId, occurrenceId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "update_maintenance_affected_rooms",
        {
          p_hotel_id: hotelId,
          p_occurrence_id: occurrenceId,
          p_actor_id: actorId,
          p_room_ids: input.room_ids,
          p_reason: input.reason,
        },
      );
      if (error) throw error;
      return object(data) as Result;
    },
    async recurrence(hotelId, occurrenceId) {
      const client = createServerClient();
      const { data: memberships, error } = await client
        .from("maintenance_recurrence_members")
        .select("group_id")
        .eq("hotel_id", hotelId)
        .eq("occurrence_id", occurrenceId);
      if (error) throw error;
      const groupId = memberships?.[0]?.group_id;
      if (!groupId) return { active: false, group: null, occurrences: [] };
      const [{ data: group }, { data: members }] = await Promise.all([
        client
          .from("maintenance_recurrence_groups")
          .select("*")
          .eq("hotel_id", hotelId)
          .eq("id", groupId)
          .maybeSingle(),
        client
          .from("maintenance_recurrence_members")
          .select("occurrence_id")
          .eq("hotel_id", hotelId)
          .eq("group_id", groupId),
      ]);
      return {
        active: group?.status === "active",
        group,
        occurrences: members || [],
      };
    },
    async saveRecurrencePolicy(hotelId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "save_maintenance_recurrence_policy",
        {
          p_hotel_id: hotelId,
          p_actor_id: actorId,
          p_input: input as unknown as Json,
        },
      );
      if (error) throw error;
      return object(data) as Result;
    },
    async actRecurrence(hotelId, groupId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "act_maintenance_recurrence_group",
        {
          p_hotel_id: hotelId,
          p_group_id: groupId,
          p_actor_id: actorId,
          p_input: input as unknown as Json,
        },
      );
      if (error) throw error;
      return object(data) as Result;
    },
    async createLifecycle(hotelId, occurrenceId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "create_maintenance_lifecycle_decision",
        {
          p_hotel_id: hotelId,
          p_occurrence_id: occurrenceId,
          p_actor_id: actorId,
          p_input: input as unknown as Json,
        },
      );
      if (error) throw error;
      return object(data) as Result;
    },
    async actLifecycle(hotelId, decisionId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "act_maintenance_lifecycle_decision",
        {
          p_hotel_id: hotelId,
          p_decision_id: decisionId,
          p_actor_id: actorId,
          p_input: input as unknown as Json,
        },
      );
      if (error) throw error;
      return object(data) as Result;
    },
    async confirmService(hotelId, orderId, actorId, input) {
      const { data, error } = await createServerClient().rpc(
        "record_maintenance_service_confirmation",
        {
          p_hotel_id: hotelId,
          p_work_order_id: orderId,
          p_actor_id: actorId,
          p_result: input.result,
          p_notes: input.notes,
        },
      );
      if (error) throw error;
      return object(data) as Result;
    },
    async recordCommunication(hotelId, orderId, actorId, input) {
      const order = await createServerClient()
        .from("maintenance_work_orders")
        .select("id")
        .eq("hotel_id", hotelId)
        .eq("id", orderId)
        .maybeSingle();
      if (order.error || !order.data) return { result: "not_found" };
      const { error } = await createServerClient()
        .from("maintenance_service_communications")
        .insert({
          hotel_id: hotelId,
          work_order_id: orderId,
          audience: String(input.audience),
          channel: String(input.channel),
          promised_at: String(input.promised_at),
          notes: String(input.notes),
          communicated_by: actorId,
        });
      return { result: error ? "invalid" : "ok" };
    },
    async reconcile(hotelId) {
      const { error } = await createServerClient().rpc(
        "refresh_maintenance_impact_scores",
        {
          p_hotel_id: hotelId,
          p_now: new Date().toISOString(),
        },
      );
      if (error) throw error;
      return { result: "ok" };
    },
  };
}
