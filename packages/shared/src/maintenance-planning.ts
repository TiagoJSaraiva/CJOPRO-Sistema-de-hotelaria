import { Type, type Static } from "typebox";

const uuid = () => Type.String({ format: "uuid" });
const nullableString = Type.Union([Type.String(), Type.Null()]);

export type MaintenancePriorityLevel = "low" | "normal" | "high" | "critical";

export type MaintenanceImpactFactors = {
  technicalPriority: MaintenancePriorityLevel;
  guestPresent: boolean;
  nextArrivalHours: number | null;
  affectedRooms: number;
  activeBlock: boolean;
  impactHours: number;
  recurrent: boolean;
};

export type MaintenanceImpactScore = {
  score: number;
  recommendedPriority: MaintenancePriorityLevel;
  components: Array<{ key: string; points: number }>;
};

const PRIORITY_BASE: Record<MaintenancePriorityLevel, number> = {
  low: 10,
  normal: 30,
  high: 55,
  critical: 80,
};

export function calculateMaintenanceImpactScore(
  factors: MaintenanceImpactFactors,
): MaintenanceImpactScore {
  const components = [
    {
      key: "technical_priority",
      points: PRIORITY_BASE[factors.technicalPriority],
    },
    { key: "guest_present", points: factors.guestPresent ? 20 : 0 },
    {
      key: "next_arrival",
      points:
        factors.nextArrivalHours === null
          ? 0
          : factors.nextArrivalHours <= 0
            ? 20
            : factors.nextArrivalHours <= 24
              ? 15
              : factors.nextArrivalHours <= 72
                ? 5
                : 0,
    },
    {
      key: "affected_rooms",
      points: Math.min(Math.max(factors.affectedRooms, 0) * 4, 16),
    },
    { key: "active_block", points: factors.activeBlock ? 10 : 0 },
    {
      key: "impact_duration",
      points:
        factors.impactHours >= 72 ? 15 : factors.impactHours >= 24 ? 8 : 0,
    },
    { key: "recurrence", points: factors.recurrent ? 8 : 0 },
  ].filter((component) => component.points > 0);
  const score = Math.min(
    100,
    components.reduce((sum, component) => sum + component.points, 0),
  );
  return {
    score,
    recommendedPriority:
      score >= 80
        ? "critical"
        : score >= 55
          ? "high"
          : score >= 30
            ? "normal"
            : "low",
    components,
  };
}

export type MaintenanceScheduleConflictKind =
  | "technician_overlap"
  | "team_capacity"
  | "outside_availability"
  | "access_window"
  | "room_occupancy"
  | "room_arrival"
  | "governance"
  | "room_block";

export const MaintenancePlanningBoardSchema = Type.Object(
  {
    generated_at: Type.String(),
    teams: Type.Array(
      Type.Object({
        id: uuid(),
        name: Type.String(),
        description: nullableString,
        is_active: Type.Boolean(),
        version: Type.Integer(),
        members: Type.Array(
          Type.Object({
            id: uuid(),
            user_id: uuid(),
            user_name: Type.String(),
            role: Type.String(),
            valid_from: Type.String(),
            valid_until: nullableString,
          }),
        ),
        availability: Type.Array(
          Type.Object({
            id: uuid(),
            user_id: Type.Union([uuid(), Type.Null()]),
            weekday: Type.Integer(),
            starts_at: Type.String(),
            ends_at: Type.String(),
            capacity: Type.Integer(),
          }),
        ),
        exceptions: Type.Optional(
          Type.Array(
            Type.Object({
              id: uuid(),
              user_id: Type.Union([uuid(), Type.Null()]),
              kind: Type.String(),
              starts_at: Type.String(),
              ends_at: Type.String(),
              capacity_delta: Type.Integer(),
              reason: Type.String(),
            }),
          ),
        ),
      }),
    ),
    schedules: Type.Array(
      Type.Object({
        id: uuid(),
        work_order_id: uuid(),
        occurrence_id: uuid(),
        occurrence_code: Type.String(),
        title: Type.String(),
        room_number: nullableString,
        team_id: Type.Union([uuid(), Type.Null()]),
        team_name: nullableString,
        technician_id: Type.Union([uuid(), Type.Null()]),
        technician_name: nullableString,
        planned_start: Type.String(),
        planned_end: Type.String(),
        estimated_minutes: Type.Integer(),
        status: Type.String(),
        access_kind: Type.String(),
        access_notes: nullableString,
        version: Type.Integer(),
        impact_score: Type.Integer(),
        recommended_priority: Type.String(),
        next_arrival_at: nullableString,
      }),
    ),
    backlog: Type.Array(
      Type.Object({
        work_order_id: uuid(),
        occurrence_id: uuid(),
        occurrence_code: Type.String(),
        title: Type.String(),
        priority: Type.String(),
        impact_score: Type.Integer(),
        recommended_priority: Type.String(),
        room_number: nullableString,
        due_at: nullableString,
      }),
    ),
    reschedule_requests: Type.Optional(
      Type.Array(
        Type.Object({
          id: uuid(),
          work_order_id: uuid(),
          occurrence_code: Type.String(),
          title: Type.String(),
          requester_name: Type.String(),
          requested_start: nullableString,
          reason: Type.String(),
          created_at: Type.String(),
        }),
      ),
    ),
    users: Type.Array(Type.Object({ id: uuid(), name: Type.String() })),
    summary: Type.Object({
      scheduled: Type.Integer(),
      backlog: Type.Integer(),
      conflicts: Type.Integer(),
      capacity_minutes: Type.Integer(),
      allocated_minutes: Type.Integer(),
    }),
  },
  { additionalProperties: false, $id: "MaintenancePlanningBoard" },
);

export const MaintenanceTeamInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 2, maxLength: 120 }),
    description: Type.Optional(Type.String({ maxLength: 1000 })),
    expected_version: Type.Optional(Type.Integer({ minimum: 1 })),
    members: Type.Array(
      Type.Object({
        user_id: uuid(),
        role: Type.String({ minLength: 2, maxLength: 80 }),
        valid_from: Type.String({ format: "date" }),
        valid_until: Type.Optional(Type.String({ format: "date" })),
      }),
      { minItems: 1, maxItems: 100 },
    ),
    availability: Type.Array(
      Type.Object({
        user_id: Type.Optional(uuid()),
        weekday: Type.Integer({ minimum: 0, maximum: 6 }),
        starts_at: Type.String(),
        ends_at: Type.String(),
        capacity: Type.Integer({ minimum: 1, maximum: 100 }),
      }),
      { minItems: 1, maxItems: 100 },
    ),
  },
  { additionalProperties: false, $id: "MaintenanceTeamInput" },
);

export const MaintenanceScheduleInputSchema = Type.Object(
  {
    team_id: Type.Optional(uuid()),
    technician_id: Type.Optional(uuid()),
    planned_start: Type.String({ format: "date-time" }),
    estimated_minutes: Type.Integer({ minimum: 5, maximum: 10080 }),
    access_kind: Type.Union([
      Type.Literal("free"),
      Type.Literal("vacant_room"),
      Type.Literal("guest_authorized"),
      Type.Literal("front_desk_coordination"),
    ]),
    access_notes: Type.Optional(Type.String({ maxLength: 1000 })),
    expected_version: Type.Optional(Type.Integer({ minimum: 1 })),
    override_conflicts: Type.Optional(Type.Boolean()),
    override_reason: Type.Optional(
      Type.String({ minLength: 3, maxLength: 1000 }),
    ),
  },
  { additionalProperties: false, $id: "MaintenanceScheduleInput" },
);

export const MaintenanceAvailabilityExceptionSchema = Type.Object(
  {
    team_id: Type.Optional(uuid()),
    user_id: Type.Optional(uuid()),
    kind: Type.Union([
      Type.Literal("unavailable"),
      Type.Literal("additional_capacity"),
    ]),
    starts_at: Type.String({ format: "date-time" }),
    ends_at: Type.String({ format: "date-time" }),
    capacity_delta: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  { additionalProperties: false, $id: "MaintenanceAvailabilityExceptionInput" },
);

export const MaintenanceScheduleSimulationSchema = Type.Object(
  {
    valid: Type.Boolean(),
    planned_end: Type.String(),
    conflicts: Type.Array(
      Type.Object({ kind: Type.String(), message: Type.String() }),
    ),
  },
  { additionalProperties: false, $id: "MaintenanceScheduleSimulation" },
);

export const MaintenanceWaitingFollowupInputSchema = Type.Object(
  {
    notes: Type.String({ minLength: 3, maxLength: 2000 }),
    next_follow_up_at: Type.String({ format: "date-time" }),
    expected_version: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false, $id: "MaintenanceWaitingFollowupInput" },
);

export const MaintenanceRescheduleRequestSchema = Type.Object(
  {
    requested_start: Type.Optional(Type.String({ format: "date-time" })),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  { additionalProperties: false, $id: "MaintenanceRescheduleRequestInput" },
);

export const MaintenanceRescheduleDecisionSchema = Type.Object(
  {
    approved: Type.Boolean(),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  { additionalProperties: false, $id: "MaintenanceRescheduleDecisionInput" },
);

export const MaintenanceAffectedRoomsInputSchema = Type.Object(
  {
    room_ids: Type.Array(uuid(), { maxItems: 500, uniqueItems: true }),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  { additionalProperties: false, $id: "MaintenanceAffectedRoomsInput" },
);

export const MaintenanceRecurrencePolicyInputSchema = Type.Object(
  {
    category_id: Type.Optional(uuid()),
    window_days: Type.Integer({ minimum: 1, maximum: 730 }),
    occurrence_threshold: Type.Integer({ minimum: 2, maximum: 20 }),
    expected_version: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false, $id: "MaintenanceRecurrencePolicyInput" },
);

export const MaintenanceRecurrenceActionSchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("false_positive"),
      Type.Literal("close"),
      Type.Literal("merge"),
    ]),
    target_group_id: Type.Optional(uuid()),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  { additionalProperties: false, $id: "MaintenanceRecurrenceActionInput" },
);

const LifecycleOptionSchema = Type.Object({
  kind: Type.Union([
    Type.Literal("repair"),
    Type.Literal("replace"),
    Type.Literal("warranty"),
  ]),
  estimated_cost: Type.Number({ minimum: 0 }),
  estimated_downtime_hours: Type.Integer({ minimum: 0, maximum: 8760 }),
  supplier_id: Type.Optional(uuid()),
  contract_id: Type.Optional(uuid()),
  cost_item_id: Type.Optional(uuid()),
  risks: Type.String({ minLength: 3, maxLength: 2000 }),
  benefits: Type.String({ minLength: 3, maxLength: 2000 }),
  justification: Type.String({ minLength: 3, maxLength: 2000 }),
});

export const MaintenanceLifecycleCreateSchema = Type.Object(
  {
    recommendation: Type.Union([
      Type.Literal("repair"),
      Type.Literal("replace"),
      Type.Literal("warranty"),
    ]),
    single_option_reason: Type.Optional(
      Type.String({ minLength: 3, maxLength: 1000 }),
    ),
    options: Type.Array(LifecycleOptionSchema, { minItems: 1, maxItems: 3 }),
  },
  { additionalProperties: false, $id: "MaintenanceLifecycleCreateInput" },
);

export const MaintenanceLifecycleActionSchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("submit"),
      Type.Literal("approve"),
      Type.Literal("reject"),
      Type.Literal("execute"),
      Type.Literal("cancel"),
    ]),
    expected_version: Type.Integer({ minimum: 1 }),
    selected_option_id: Type.Optional(uuid()),
    reason: Type.String({ minLength: 3, maxLength: 2000 }),
    replacement_location_id: Type.Optional(uuid()),
  },
  { additionalProperties: false, $id: "MaintenanceLifecycleActionInput" },
);

export const MaintenanceServiceConfirmationSchema = Type.Object(
  {
    result: Type.Union([
      Type.Literal("arrived"),
      Type.Literal("access_obtained"),
      Type.Literal("provider_absent"),
      Type.Literal("access_denied"),
    ]),
    notes: Type.String({ minLength: 3, maxLength: 2000 }),
  },
  { additionalProperties: false, $id: "MaintenanceServiceConfirmationInput" },
);

export const MaintenanceServiceCommunicationSchema = Type.Object(
  {
    audience: Type.Union([
      Type.Literal("front_desk"),
      Type.Literal("guest"),
      Type.Literal("requester"),
      Type.Literal("internal"),
    ]),
    channel: Type.Union([
      Type.Literal("in_person"),
      Type.Literal("phone"),
      Type.Literal("message"),
      Type.Literal("other"),
    ]),
    promised_at: Type.String({ format: "date-time" }),
    notes: Type.String({ minLength: 3, maxLength: 2000 }),
  },
  { additionalProperties: false, $id: "MaintenanceServiceCommunicationInput" },
);

export type MaintenancePlanningBoard = Static<
  typeof MaintenancePlanningBoardSchema
>;
export type MaintenanceTeamInput = Static<typeof MaintenanceTeamInputSchema>;
export type MaintenanceScheduleInput = Static<
  typeof MaintenanceScheduleInputSchema
>;
export type MaintenanceAvailabilityExceptionInput = Static<
  typeof MaintenanceAvailabilityExceptionSchema
>;
export type MaintenanceScheduleSimulation = Static<
  typeof MaintenanceScheduleSimulationSchema
>;
export type MaintenanceWaitingFollowupInput = Static<
  typeof MaintenanceWaitingFollowupInputSchema
>;
export type MaintenanceRescheduleRequestInput = Static<
  typeof MaintenanceRescheduleRequestSchema
>;
export type MaintenanceRescheduleDecisionInput = Static<
  typeof MaintenanceRescheduleDecisionSchema
>;
export type MaintenanceAffectedRoomsInput = Static<
  typeof MaintenanceAffectedRoomsInputSchema
>;
export type MaintenanceRecurrencePolicyInput = Static<
  typeof MaintenanceRecurrencePolicyInputSchema
>;
export type MaintenanceRecurrenceActionInput = Static<
  typeof MaintenanceRecurrenceActionSchema
>;
export type MaintenanceLifecycleCreateInput = Static<
  typeof MaintenanceLifecycleCreateSchema
>;
export type MaintenanceLifecycleActionInput = Static<
  typeof MaintenanceLifecycleActionSchema
>;
export type MaintenanceServiceConfirmationInput = Static<
  typeof MaintenanceServiceConfirmationSchema
>;
export type MaintenanceServiceCommunicationInput = Static<
  typeof MaintenanceServiceCommunicationSchema
>;
