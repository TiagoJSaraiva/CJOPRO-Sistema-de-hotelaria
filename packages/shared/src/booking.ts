import { Type, type Static } from "typebox";

const strict = { additionalProperties: false } as const;
const uuid = () => Type.String({ format: "uuid" });
const date = () => Type.String({ format: "date" });

export const RatePlanInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 2, maxLength: 120 }),
    code: Type.String({ minLength: 2, maxLength: 40 }),
    kind: Type.Union([
      Type.Literal("flexible"),
      Type.Literal("non_refundable"),
      Type.Literal("package"),
    ]),
    description: Type.Optional(Type.String({ maxLength: 500 })),
  },
  { ...strict, $id: "RatePlanInput" },
);
export type RatePlanInput = Static<typeof RatePlanInputSchema>;

export const RatePlanVersionInputSchema = Type.Object(
  {
    currency: Type.String({ minLength: 3, maxLength: 3 }),
    adjustment_type: Type.Union([
      Type.Literal("fixed"),
      Type.Literal("percentage"),
    ]),
    adjustment_value: Type.Number({ minimum: -1000000, maximum: 1000000 }),
    included_adults: Type.Integer({ minimum: 1, maximum: 20 }),
    included_children: Type.Integer({ minimum: 0, maximum: 20 }),
    extra_adult_amount: Type.Number({ minimum: 0 }),
    extra_child_amount: Type.Number({ minimum: 0 }),
    guarantee_type: Type.Union([
      Type.Literal("none"),
      Type.Literal("fixed"),
      Type.Literal("percentage"),
      Type.Literal("first_night"),
    ]),
    guarantee_value: Type.Number({ minimum: 0 }),
    hold_hours: Type.Integer({ minimum: 1, maximum: 720 }),
    cancellation_type: Type.Union([
      Type.Literal("none"),
      Type.Literal("fixed"),
      Type.Literal("percentage"),
      Type.Literal("first_night"),
      Type.Literal("full_stay"),
    ]),
    cancellation_value: Type.Number({ minimum: 0 }),
    cancellation_cutoff_hours: Type.Integer({ minimum: 0, maximum: 8760 }),
    benefit_plan_version_id: Type.Optional(Type.Union([uuid(), Type.Null()])),
    channels: Type.Array(
      Type.Union([
        Type.Literal("internal"),
        Type.Literal("direct"),
        Type.Literal("channel"),
      ]),
      { minItems: 1, uniqueItems: true },
    ),
    room_types: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), {
      minItems: 1,
      uniqueItems: true,
    }),
    activate: Type.Optional(Type.Boolean()),
  },
  { ...strict, $id: "RatePlanVersionInput" },
);
export type RatePlanVersionInput = Static<typeof RatePlanVersionInputSchema>;

export const VersionedBookingActionSchema = Type.Object(
  {
    action: Type.String({ minLength: 2, maxLength: 40 }),
    expected_version: Type.Integer({ minimum: 1 }),
    reason: Type.Optional(Type.String({ minLength: 3, maxLength: 500 })),
  },
  { ...strict, $id: "VersionedBookingAction" },
);
export type VersionedBookingAction = Static<
  typeof VersionedBookingActionSchema
>;

export const ReservationAmendmentInputSchema = Type.Object(
  {
    accommodation_id: uuid(),
    checkin_date: date(),
    checkout_date: date(),
    room_type: Type.String({ minLength: 1, maxLength: 80 }),
    adults: Type.Integer({ minimum: 1, maximum: 20 }),
    children: Type.Integer({ minimum: 0, maximum: 20 }),
    expected_version: Type.Integer({ minimum: 1 }),
    idempotency_key: uuid(),
    reason: Type.String({ minLength: 3, maxLength: 500 }),
    waive_price_delta: Type.Optional(Type.Boolean()),
  },
  { ...strict, $id: "ReservationAmendmentInput" },
);
export type ReservationAmendmentInput = Static<
  typeof ReservationAmendmentInputSchema
>;

export const ReservationGuaranteeInputSchema = Type.Object(
  {
    expected_version: Type.Integer({ minimum: 1 }),
    idempotency_key: uuid(),
    tenders: Type.Array(
      Type.Object(
        {
          method: Type.String({ minLength: 2, maxLength: 40 }),
          amount: Type.Number({ exclusiveMinimum: 0 }),
          reference: Type.Optional(Type.String({ maxLength: 120 })),
          cash_session_id: Type.Optional(Type.Union([uuid(), Type.Null()])),
        },
        strict,
      ),
    ),
    waive: Type.Optional(Type.Boolean()),
    reason: Type.Optional(Type.String({ minLength: 3, maxLength: 500 })),
  },
  { ...strict, $id: "ReservationGuaranteeInput" },
);
export type ReservationGuaranteeInput = Static<
  typeof ReservationGuaranteeInputSchema
>;

export const RoomAssignmentInputSchema = Type.Object(
  {
    accommodation_id: uuid(),
    room_id: uuid(),
    expected_version: Type.Integer({ minimum: 1 }),
    idempotency_key: uuid(),
    reason: Type.String({ minLength: 3, maxLength: 500 }),
  },
  { ...strict, $id: "RoomAssignmentInput" },
);
export type RoomAssignmentInput = Static<typeof RoomAssignmentInputSchema>;

export const GuestPreferenceInputSchema = Type.Object(
  {
    category: Type.Union([
      Type.Literal("room"),
      Type.Literal("service"),
      Type.Literal("food"),
      Type.Literal("accessibility"),
      Type.Literal("communication"),
      Type.Literal("other"),
    ]),
    value: Type.String({ minLength: 2, maxLength: 500 }),
    source: Type.Union([Type.Literal("guest"), Type.Literal("staff")]),
    consent_version: Type.String({ minLength: 1, maxLength: 80 }),
    valid_until: Type.Optional(Type.Union([date(), Type.Null()])),
  },
  { ...strict, $id: "GuestPreferenceInput" },
);
export type GuestPreferenceInput = Static<typeof GuestPreferenceInputSchema>;

export const PrearrivalLinkInputSchema = Type.Object(
  { expires_in_hours: Type.Integer({ minimum: 1, maximum: 2160 }) },
  { ...strict, $id: "PrearrivalLinkInput" },
);
export type PrearrivalLinkInput = Static<typeof PrearrivalLinkInputSchema>;

export const PrearrivalRequestActionSchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("triage"),
      Type.Literal("accept"),
      Type.Literal("reject"),
      Type.Literal("convert"),
      Type.Literal("resolve"),
      Type.Literal("cancel"),
    ]),
    expected_version: Type.Integer({ minimum: 1 }),
    reason: Type.String({ minLength: 3, maxLength: 500 }),
    assignee_id: Type.Optional(Type.Union([uuid(), Type.Null()])),
    next_action: Type.Optional(Type.String({ maxLength: 300 })),
  },
  { ...strict, $id: "PrearrivalRequestAction" },
);
export type PrearrivalRequestAction = Static<
  typeof PrearrivalRequestActionSchema
>;

export const BookingConfigurationInputSchema = Type.Object(
  {
    published: Type.Boolean(),
    primary_color: Type.String({ pattern: "^#[0-9A-Fa-f]{6}$" }),
    introduction: Type.String({ maxLength: 1000 }),
    guarantee_instructions: Type.String({ maxLength: 1000 }),
    terms: Type.String({ minLength: 3, maxLength: 10000 }),
    consent_version: Type.String({ minLength: 1, maxLength: 80 }),
  },
  { ...strict, $id: "BookingConfigurationInput" },
);
export type BookingConfigurationInput = Static<
  typeof BookingConfigurationInputSchema
>;

export const BookingChannelInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 2, maxLength: 120 }),
    code: Type.String({ minLength: 2, maxLength: 50 }),
    active: Type.Optional(Type.Boolean()),
  },
  { ...strict, $id: "BookingChannelInput" },
);
export type BookingChannelInput = Static<typeof BookingChannelInputSchema>;

export const BookingChannelMappingInputSchema = Type.Object(
  {
    external_room_code: Type.String({ minLength: 1, maxLength: 100 }),
    room_type: Type.String({ minLength: 1, maxLength: 80 }),
    external_rate_code: Type.String({ minLength: 1, maxLength: 100 }),
    rate_plan_id: uuid(),
  },
  { ...strict, $id: "BookingChannelMappingInput" },
);
export type BookingChannelMappingInput = Static<
  typeof BookingChannelMappingInputSchema
>;

export const BookingChannelEventInputSchema = Type.Object(
  {
    event_id: Type.String({ minLength: 1, maxLength: 160 }),
    event_type: Type.Union([Type.Literal("create"), Type.Literal("amend"), Type.Literal("cancel")]),
    external_reservation_id: Type.String({ minLength: 1, maxLength: 160 }),
    occurred_at: Type.String({ format: "date-time" }),
    reservation: Type.Object(
      {
        room_code: Type.String({ minLength: 1, maxLength: 100 }),
        rate_code: Type.String({ minLength: 1, maxLength: 100 }),
        checkin_date: date(),
        checkout_date: date(),
        adults: Type.Integer({ minimum: 1, maximum: 20 }),
        children: Type.Integer({ minimum: 0, maximum: 20 }),
        currency: Type.String({ minLength: 3, maxLength: 3 }),
        total: Type.Number({ minimum: 0 }),
        guest_name: Type.String({ minLength: 2, maxLength: 160 }),
        guest_email: Type.Optional(Type.String({ format: "email" })),
        guest_phone: Type.Optional(Type.String({ maxLength: 40 })),
      },
      strict,
    ),
  },
  { ...strict, $id: "BookingChannelEventInput" },
);
export type BookingChannelEventInput = Static<typeof BookingChannelEventInputSchema>;

export const BookingChannelEventActionSchema = Type.Object(
  {
    action: Type.Union([Type.Literal("apply"), Type.Literal("reject"), Type.Literal("resolve")]),
    expected_version: Type.Integer({ minimum: 1 }),
    reason: Type.String({ minLength: 3, maxLength: 500 }),
  },
  { ...strict, $id: "BookingChannelEventAction" },
);
export type BookingChannelEventAction = Static<typeof BookingChannelEventActionSchema>;

export const PublicBookingQuoteInputSchema = Type.Object(
  {
    checkin_date: date(),
    checkout_date: date(),
    rooms: Type.Array(
      Type.Object(
        {
          adults: Type.Integer({ minimum: 1, maximum: 20 }),
          children: Type.Integer({ minimum: 0, maximum: 20 }),
        },
        strict,
      ),
      { minItems: 1, maxItems: 20 },
    ),
  },
  { ...strict, $id: "PublicBookingQuoteInput" },
);
export type PublicBookingQuoteInput = Static<
  typeof PublicBookingQuoteInputSchema
>;

export const PublicBookingHoldInputSchema = Type.Object(
  {
    quote_id: uuid(),
    quote_fingerprint: Type.String({ minLength: 32, maxLength: 128 }),
    idempotency_key: uuid(),
    contact_name: Type.String({ minLength: 2, maxLength: 160 }),
    email: Type.Optional(Type.String({ format: "email" })),
    phone: Type.Optional(Type.String({ minLength: 5, maxLength: 40 })),
    consent_version: Type.String({ minLength: 1, maxLength: 80 }),
    selections: Type.Array(
      Type.Object(
        {
          quote_item_id: uuid(),
          room_type: Type.String({ minLength: 1, maxLength: 80 }),
          rate_plan_version_id: uuid(),
        },
        strict,
      ),
      { minItems: 1, maxItems: 20 },
    ),
  },
  { ...strict, $id: "PublicBookingHoldInput" },
);
export type PublicBookingHoldInput = Static<typeof PublicBookingHoldInputSchema>;

export const PublicPrearrivalInputSchema = Type.Object(
  {
    expected_version: Type.Integer({ minimum: 1 }),
    arrival_time: Type.Optional(Type.String({ pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" })),
    primary_guest: Type.Optional(
      Type.Object(
        {
          full_name: Type.String({ minLength: 2, maxLength: 160 }),
          document_type: Type.String({ minLength: 1, maxLength: 40 }),
          document_number: Type.String({ minLength: 2, maxLength: 60 }),
          birth_date: date(),
        },
        strict,
      ),
    ),
    companions: Type.Optional(
      Type.Array(
        Type.Object(
          {
            accommodation_id: uuid(),
            full_name: Type.String({ minLength: 2, maxLength: 160 }),
            document_type: Type.Optional(Type.String({ maxLength: 40 })),
            document_number: Type.Optional(Type.String({ maxLength: 60 })),
            birth_date: Type.Optional(date()),
          },
          strict,
        ),
        { maxItems: 40 },
      ),
    ),
    requests: Type.Optional(
      Type.Array(
        Type.Object(
          {
            accommodation_id: Type.Optional(Type.Union([uuid(), Type.Null()])),
            category: Type.Union([
              Type.Literal("accessibility"),
              Type.Literal("room_preference"),
              Type.Literal("food"),
              Type.Literal("celebration"),
              Type.Literal("service"),
              Type.Literal("other"),
            ]),
            description: Type.String({ minLength: 3, maxLength: 1000 }),
          },
          strict,
        ),
        { maxItems: 20 },
      ),
    ),
  },
  { ...strict, $id: "PublicPrearrivalInput" },
);
export type PublicPrearrivalInput = Static<typeof PublicPrearrivalInputSchema>;

export const PublicChangeRequestInputSchema = Type.Object(
  {
    type: Type.Union([Type.Literal("amendment"), Type.Literal("cancellation")]),
    description: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  { ...strict, $id: "PublicChangeRequestInput" },
);
export type PublicChangeRequestInput = Static<
  typeof PublicChangeRequestInputSchema
>;

export type GuaranteePolicy = {
  type: "none" | "fixed" | "percentage" | "first_night";
  value: number;
};
export type CancellationPolicy = {
  type: "none" | "fixed" | "percentage" | "first_night" | "full_stay";
  value: number;
};
const money = (value: number) => Number(Math.max(0, value).toFixed(2));

export function calculateGuarantee(
  policy: GuaranteePolicy,
  total: number,
  firstNight: number,
): number {
  if (policy.type === "none") return 0;
  if (policy.type === "fixed") return money(policy.value);
  if (policy.type === "percentage") return money(total * (policy.value / 100));
  return money(firstNight);
}

export function calculateCancellationPenalty(
  policy: CancellationPolicy,
  total: number,
  firstNight: number,
): number {
  if (policy.type === "none") return 0;
  if (policy.type === "fixed") return money(policy.value);
  if (policy.type === "percentage") return money(total * (policy.value / 100));
  if (policy.type === "first_night") return money(firstNight);
  return money(total);
}

export function calculateNightPrice(input: {
  base: number;
  seasonal: number;
  adjustmentType: "fixed" | "percentage";
  adjustmentValue: number;
  adults: number;
  children: number;
  includedAdults: number;
  includedChildren: number;
  extraAdult: number;
  extraChild: number;
}): number {
  const publicBase = input.base + input.seasonal;
  const adjusted =
    input.adjustmentType === "percentage"
      ? publicBase * (1 + input.adjustmentValue / 100)
      : publicBase + input.adjustmentValue;
  return money(
    adjusted +
      Math.max(0, input.adults - input.includedAdults) * input.extraAdult +
      Math.max(0, input.children - input.includedChildren) * input.extraChild,
  );
}

export function isHoldActive(
  status: string,
  expiresAt: string | null,
  now: Date,
): boolean {
  return status === "held" && !!expiresAt && new Date(expiresAt) > now;
}

export function amendmentDelta(
  current: Array<{ date: string; amount: number }>,
  proposed: Array<{ date: string; amount: number }>,
): { preserved: string[]; removed: string[]; added: string[]; delta: number } {
  const oldByDate = new Map(current.map((item) => [item.date, item.amount]));
  const newByDate = new Map(proposed.map((item) => [item.date, item.amount]));
  const preserved = [...oldByDate.keys()].filter((item) => newByDate.has(item));
  const removed = [...oldByDate.keys()].filter((item) => !newByDate.has(item));
  const added = [...newByDate.keys()].filter((item) => !oldByDate.has(item));
  const oldTotal = current.reduce((sum, item) => sum + item.amount, 0);
  const newTotal = proposed.reduce((sum, item) => sum + item.amount, 0);
  return { preserved, removed, added, delta: money(newTotal - oldTotal) };
}
