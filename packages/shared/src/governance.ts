import { Type, type Static } from "typebox";

const uuid = () => Type.String({ format: "uuid" });
const nullableText = Type.Union([Type.String(), Type.Null()]);

export const GovernanceCycleStatusSchema = Type.Union([
  Type.Literal("departure_review"),
  Type.Literal("cleaning_pending"),
  Type.Literal("cleaning_in_progress"),
  Type.Literal("inspection_pending"),
  Type.Literal("maintenance_hold"),
  Type.Literal("released"),
  Type.Literal("canceled"),
]);
export const GovernanceTaskKindSchema = Type.Union([
  Type.Literal("departure_review"),
  Type.Literal("cleaning"),
  Type.Literal("replenishment"),
  Type.Literal("inspection"),
]);
export const GovernanceTaskStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("assigned"),
  Type.Literal("in_progress"),
  Type.Literal("completed"),
  Type.Literal("canceled"),
]);
export const RoomOperationalStateSchema = Type.Object(
  {
    room_id: uuid(),
    occupancy: Type.Union([
      Type.Literal("vacant"),
      Type.Literal("occupied"),
      Type.Literal("arrival_expected"),
    ]),
    housekeeping: Type.Union([
      Type.Literal("ready"),
      Type.Literal("departure_review"),
      Type.Literal("cleaning_pending"),
      Type.Literal("cleaning_in_progress"),
      Type.Literal("inspection_pending"),
      Type.Literal("maintenance_hold"),
    ]),
    maintenance: Type.Union([Type.Literal("clear"), Type.Literal("blocked")]),
    readiness: Type.Union([
      Type.Literal("ready"),
      Type.Literal("not_ready"),
      Type.Literal("blocked"),
    ]),
    cycle_id: Type.Union([uuid(), Type.Null()]),
    cycle_version: Type.Union([Type.Integer(), Type.Null()]),
    next_arrival_at: nullableText,
    assignee_id: nullableText,
    assignee_name: nullableText,
    last_updated_at: nullableText,
    blockers: Type.Array(Type.String()),
  },
  { additionalProperties: false, $id: "RoomOperationalState" },
);

export const GovernanceChecklistItemSchema = Type.Object(
  {
    id: uuid(),
    label: Type.String(),
    display_order: Type.Integer(),
    required: Type.Boolean(),
    result: Type.Union([
      Type.Literal("pending"),
      Type.Literal("approved"),
      Type.Literal("rejected"),
      Type.Literal("not_applicable"),
    ]),
    notes: nullableText,
  },
  { additionalProperties: false, $id: "GovernanceChecklistItem" },
);

export const GovernanceTaskSchema = Type.Object(
  {
    id: uuid(),
    kind: GovernanceTaskKindSchema,
    status: GovernanceTaskStatusSchema,
    assigned_to: nullableText,
    assignee_name: nullableText,
    next_action: nullableText,
    version: Type.Integer(),
    started_at: nullableText,
    completed_at: nullableText,
    checklist: Type.Array(Type.Ref("GovernanceChecklistItem")),
  },
  { additionalProperties: false, $id: "GovernanceTask" },
);

export const GovernanceEventSchema = Type.Object(
  {
    id: uuid(),
    action: Type.String(),
    message: nullableText,
    actor_name: nullableText,
    created_at: Type.String(),
  },
  { additionalProperties: false, $id: "GovernanceEvent" },
);

export const GovernanceCycleSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    room_id: uuid(),
    room_number: Type.String(),
    stay_id: Type.Union([uuid(), Type.Null()]),
    status: GovernanceCycleStatusSchema,
    source: Type.Union([
      Type.Literal("checkout"),
      Type.Literal("pre_departure"),
      Type.Literal("manual"),
      Type.Literal("maintenance"),
    ]),
    version: Type.Integer(),
    next_arrival_at: nullableText,
    severity: Type.Union([
      Type.Literal("info"),
      Type.Literal("warning"),
      Type.Literal("critical"),
    ]),
    last_updated_at: Type.String(),
    released_at: nullableText,
    tasks: Type.Array(Type.Ref("GovernanceTask")),
    events: Type.Array(Type.Ref("GovernanceEvent")),
  },
  { additionalProperties: false, $id: "GovernanceCycle" },
);

export const GovernanceBoardSchema = Type.Object(
  {
    items: Type.Array(Type.Ref("GovernanceCycle")),
    rooms: Type.Array(
      Type.Object(
        { id: uuid(), room_number: Type.String(), room_type: Type.String() },
        { additionalProperties: false },
      ),
    ),
    maintenance_categories: Type.Array(
      Type.Object(
        { id: uuid(), name: Type.String() },
        { additionalProperties: false },
      ),
    ),
    minibar_options: Type.Array(
      Type.Object(
        {
          offer_id: uuid(),
          point_id: uuid(),
          point_name: Type.String(),
          product_name: Type.String(),
        },
        { additionalProperties: false },
      ),
    ),
    assignable_users: Type.Array(
      Type.Object(
        { id: uuid(), name: Type.String() },
        { additionalProperties: false },
      ),
    ),
    summary: Type.Object(
      {
        total: Type.Integer(),
        critical: Type.Integer(),
        unassigned: Type.Integer(),
        awaiting_inspection: Type.Integer(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false, $id: "GovernanceBoard" },
);

export const GovernanceCycleCreateSchema = Type.Object(
  {
    room_id: uuid(),
    stay_id: Type.Optional(uuid()),
    source: Type.Union([Type.Literal("pre_departure"), Type.Literal("manual")]),
    note: Type.Optional(Type.String({ minLength: 1, maxLength: 1000 })),
  },
  { additionalProperties: false, $id: "GovernanceCycleCreateInput" },
);

export const GovernanceChecklistAnswerSchema = Type.Object(
  {
    item_id: uuid(),
    result: Type.Union([
      Type.Literal("approved"),
      Type.Literal("rejected"),
      Type.Literal("not_applicable"),
    ]),
    notes: Type.Optional(Type.String({ maxLength: 1000 })),
  },
  { additionalProperties: false },
);

export const GovernanceActionSchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("claim"),
      Type.Literal("release_assignment"),
      Type.Literal("assign"),
      Type.Literal("start"),
      Type.Literal("complete"),
      Type.Literal("approve"),
      Type.Literal("reject"),
      Type.Literal("handoff_note"),
      Type.Literal("cancel"),
    ]),
    task_id: Type.Optional(uuid()),
    assigned_to: Type.Optional(uuid()),
    expected_version: Type.Integer({ minimum: 1 }),
    note: Type.Optional(Type.String({ minLength: 1, maxLength: 1000 })),
    next_action: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
    answers: Type.Optional(Type.Array(GovernanceChecklistAnswerSchema)),
  },
  { additionalProperties: false, $id: "GovernanceActionInput" },
);

export const GovernanceTemplateSchema = Type.Object(
  {
    id: uuid(),
    kind: Type.Union([
      Type.Literal("departure_review"),
      Type.Literal("cleaning"),
      Type.Literal("inspection"),
    ]),
    name: Type.String(),
    version: Type.Integer(),
    is_active: Type.Boolean(),
    items: Type.Array(
      Type.Object(
        {
          label: Type.String(),
          display_order: Type.Integer(),
          required: Type.Boolean(),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false, $id: "GovernanceTemplate" },
);

export const GovernanceTemplateCreateSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("departure_review"),
      Type.Literal("cleaning"),
      Type.Literal("inspection"),
    ]),
    name: Type.String({ minLength: 1, maxLength: 120 }),
    items: Type.Array(
      Type.Object(
        {
          label: Type.String({ minLength: 1, maxLength: 240 }),
          required: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
      { minItems: 1, maxItems: 50 },
    ),
  },
  { additionalProperties: false, $id: "GovernanceTemplateCreateInput" },
);

export const StayRelocationSimulateSchema = Type.Object(
  { room_id: Type.Optional(uuid()) },
  { additionalProperties: false, $id: "StayRelocationSimulateInput" },
);
export const StayRelocationCandidateSchema = Type.Object(
  {
    room_id: uuid(),
    room_number: Type.String(),
    room_type: Type.String(),
    max_occupancy: Type.Integer(),
    public_daily_rate: Type.Number(),
    contracted_daily_rate: Type.Number(),
    rate_difference: Type.Number(),
    same_room_type: Type.Boolean(),
  },
  { additionalProperties: false, $id: "StayRelocationCandidate" },
);
export const StayRelocationConfirmSchema = Type.Object(
  {
    destination_room_id: uuid(),
    expected_version: Type.Integer({ minimum: 1 }),
    reason: Type.String({ minLength: 1, maxLength: 1000 }),
    room_block_id: Type.Optional(uuid()),
  },
  { additionalProperties: false, $id: "StayRelocationConfirmInput" },
);
export const StayCheckinSchema = Type.Object(
  {
    expected_readiness_version: Type.Optional(Type.Integer({ minimum: 1 })),
    override_reason: Type.Optional(
      Type.String({ minLength: 1, maxLength: 1000 }),
    ),
  },
  { additionalProperties: false, $id: "StayCheckinInput" },
);

const GovernanceMinibarLineSchema = Type.Object(
  {
    offer_id: uuid(),
    quantity: Type.Number({ exclusiveMinimum: 0, maximum: 9999 }),
    replenishment_quantity: Type.Optional(
      Type.Number({ minimum: 0, maximum: 9999 }),
    ),
    version_token: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export const GovernanceMinibarSchema = Type.Union(
  [
    Type.Object(
      {
        discrepancy_only: Type.Literal(true),
        idempotency_key: uuid(),
        items: Type.Array(GovernanceMinibarLineSchema, {
          minItems: 1,
          maxItems: 100,
        }),
        notes: Type.String({ minLength: 1, maxLength: 1000 }),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        discrepancy_only: Type.Optional(Type.Literal(false)),
        idempotency_key: uuid(),
        point_id: uuid(),
        occurred_at: Type.String({ format: "date-time" }),
        disposition: Type.Union([
          Type.Literal("charged"),
          Type.Literal("courtesy"),
        ]),
        billing_mode: Type.Optional(
          Type.Union([
            Type.Literal("stay_folio"),
            Type.Literal("hotel_immediate"),
            Type.Literal("partner_direct"),
          ]),
        ),
        items: Type.Array(GovernanceMinibarLineSchema, {
          minItems: 1,
          maxItems: 100,
        }),
        guest_customer_id: Type.Optional(uuid()),
        payment_method: Type.Optional(Type.String()),
        payment_reference: Type.Optional(Type.String()),
        partner_receipt_confirmed: Type.Optional(Type.Boolean()),
        notes: Type.Optional(Type.String({ maxLength: 1000 })),
        courtesy_reason: Type.Optional(Type.String({ maxLength: 1000 })),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: "GovernanceMinibarInput" },
);

export const GovernanceDefectSchema = Type.Object(
  {
    category_id: uuid(),
    kind: Type.Union([
      Type.Literal("damage"),
      Type.Literal("defect"),
      Type.Literal("wear"),
      Type.Literal("safety_risk"),
      Type.Literal("special_cleaning"),
      Type.Literal("other"),
    ]),
    priority: Type.Union([
      Type.Literal("low"),
      Type.Literal("normal"),
      Type.Literal("high"),
      Type.Literal("critical"),
    ]),
    description: Type.String({ minLength: 3, maxLength: 2000 }),
    blocking: Type.Boolean(),
    block_end_date: Type.Optional(Type.String({ format: "date" })),
    conflict_acknowledgement: Type.Optional(
      Type.String({ minLength: 3, maxLength: 1000 }),
    ),
  },
  { additionalProperties: false, $id: "GovernanceDefectInput" },
);

type GovernanceSchemaContext = {
  GovernanceChecklistItem: typeof GovernanceChecklistItemSchema;
  GovernanceTask: typeof GovernanceTaskSchema;
  GovernanceEvent: typeof GovernanceEventSchema;
  GovernanceCycle: typeof GovernanceCycleSchema;
};

export type GovernanceCycleStatus = Static<typeof GovernanceCycleStatusSchema>;
export type RoomOperationalState = Static<typeof RoomOperationalStateSchema>;
export type GovernanceCycle = Static<
  typeof GovernanceCycleSchema,
  GovernanceSchemaContext
>;
export type GovernanceBoard = Static<
  typeof GovernanceBoardSchema,
  GovernanceSchemaContext
>;
export type GovernanceCycleCreateInput = Static<
  typeof GovernanceCycleCreateSchema
>;
export type GovernanceActionInput = Static<typeof GovernanceActionSchema>;
export type GovernanceTemplate = Static<typeof GovernanceTemplateSchema>;
export type GovernanceTemplateCreateInput = Static<
  typeof GovernanceTemplateCreateSchema
>;
export type StayRelocationCandidate = Static<
  typeof StayRelocationCandidateSchema
>;
export type StayRelocationConfirmInput = Static<
  typeof StayRelocationConfirmSchema
>;
export type StayCheckinInput = Static<typeof StayCheckinSchema>;
export type GovernanceMinibarInput = Static<typeof GovernanceMinibarSchema>;
export type GovernanceDefectInput = Static<typeof GovernanceDefectSchema>;
