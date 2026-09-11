import { Type, type Static } from "typebox";

const strict = { additionalProperties: false } as const;
const uuid = () => Type.String({ format: "uuid" });
const dateTime = () => Type.String({ format: "date-time" });
const nullableString = () => Type.Union([Type.String(), Type.Null()]);

export const ConsumptionServiceModeSchema = Type.Union([
  Type.Literal("restaurant"),
  Type.Literal("room_service"),
]);
export const ConsumptionServiceStatusSchema = Type.Union([
  Type.Literal("received"),
  Type.Literal("preparing"),
  Type.Literal("ready"),
  Type.Literal("delivered"),
  Type.Literal("canceled"),
]);
export type ConsumptionServiceStatus = Static<
  typeof ConsumptionServiceStatusSchema
>;

export const ConsumptionServiceItemInputSchema = Type.Object(
  {
    offer_id: uuid(),
    quantity: Type.Number({ exclusiveMinimum: 0, maximum: 9999 }),
    payer_account_id: Type.Optional(uuid()),
    billing_mode: Type.Optional(
      Type.Union([
        Type.Literal("stay_folio"),
        Type.Literal("hotel_immediate"),
        Type.Literal("partner_direct"),
      ]),
    ),
    payment_method: Type.Optional(
      Type.Union([
        Type.Literal("cash"),
        Type.Literal("pix"),
        Type.Literal("credit_card"),
        Type.Literal("debit_card"),
        Type.Literal("bank_transfer"),
      ]),
    ),
    payment_reference: Type.Optional(Type.String({ maxLength: 120 })),
  },
  strict,
);

export const ConsumptionServiceOrderCreateSchema = Type.Object(
  {
    stay_id: uuid(),
    point_id: uuid(),
    guest_customer_id: Type.Optional(uuid()),
    mode: ConsumptionServiceModeSchema,
    expected_at: Type.Optional(dateTime()),
    notes: Type.Optional(Type.String({ maxLength: 1000 })),
    idempotency_key: uuid(),
    items: Type.Array(ConsumptionServiceItemInputSchema, {
      minItems: 1,
      maxItems: 100,
    }),
  },
  strict,
);
export type ConsumptionServiceOrderCreate = Static<
  typeof ConsumptionServiceOrderCreateSchema
>;

export const ConsumptionServiceActionSchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("assign"),
      Type.Literal("start_preparing"),
      Type.Literal("mark_ready"),
      Type.Literal("delivery_failed"),
      Type.Literal("deliver"),
      Type.Literal("cancel"),
    ]),
    expected_version: Type.Integer({ minimum: 0 }),
    assignee_id: Type.Optional(uuid()),
    reason: Type.Optional(Type.String({ minLength: 3, maxLength: 1000 })),
    next_action: Type.Optional(Type.String({ minLength: 3, maxLength: 500 })),
    idempotency_key: Type.Optional(uuid()),
  },
  strict,
);
export type ConsumptionServiceAction = Static<
  typeof ConsumptionServiceActionSchema
>;

export const ConsumptionServiceOrderSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    stay_id: uuid(),
    point_id: uuid(),
    guest_customer_id: Type.Union([uuid(), Type.Null()]),
    mode: ConsumptionServiceModeSchema,
    status: ConsumptionServiceStatusSchema,
    responsible_id: Type.Union([uuid(), Type.Null()]),
    expected_at: Type.Union([dateTime(), Type.Null()]),
    notes: nullableString(),
    version: Type.Integer(),
    gross_amount: Type.Number(),
    reserved_benefit_amount: Type.Number(),
    created_at: dateTime(),
    updated_at: dateTime(),
    items: Type.Array(Type.Record(Type.String(), Type.Unknown())),
    events: Type.Array(Type.Record(Type.String(), Type.Unknown())),
    produced_order_ids: Type.Array(uuid()),
  },
  { ...strict, $id: "ConsumptionServiceOrder" },
);

export const StayPayerKindSchema = Type.Union([
  Type.Literal("primary_guest"),
  Type.Literal("companion"),
  Type.Literal("company"),
]);
export const StayPayerAccountSchema = Type.Object(
  {
    id: uuid(),
    stay_id: uuid(),
    kind: StayPayerKindSchema,
    customer_id: Type.Union([uuid(), Type.Null()]),
    corporate_account_id: Type.Union([uuid(), Type.Null()]),
    display_name: Type.String(),
    version: Type.Integer(),
    debit_total: Type.Number(),
    credit_total: Type.Number(),
    balance: Type.Number(),
  },
  { ...strict, $id: "StayPayerAccount" },
);
export const StayPayerAccountCreateSchema = Type.Object(
  {
    kind: Type.Union([Type.Literal("companion"), Type.Literal("company")]),
    customer_id: Type.Optional(uuid()),
    corporate_account_id: Type.Optional(uuid()),
  },
  strict,
);
export const StayPayerAllocationSchema = Type.Object(
  {
    folio_entry_id: uuid(),
    payer_account_id: uuid(),
    amount: Type.Number({ exclusiveMinimum: 0 }),
    quantity: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
  },
  strict,
);
export const StayPayerAllocationInputSchema = Type.Object(
  {
    expected_account_version: Type.Integer({ minimum: 0 }),
    allocations: Type.Array(StayPayerAllocationSchema, { minItems: 1 }),
  },
  strict,
);
export type StayPayerAllocationInput = Static<
  typeof StayPayerAllocationInputSchema
>;
export const StayPayerPaymentInputSchema = Type.Object(
  {
    payer_account_id: uuid(),
    expected_account_version: Type.Integer({ minimum: 0 }),
    idempotency_key: uuid(),
    note: Type.Optional(Type.String({ maxLength: 1000 })),
    tenders: Type.Array(
      Type.Object(
        {
          payment_method: Type.String({ minLength: 1, maxLength: 40 }),
          amount: Type.Number({ exclusiveMinimum: 0 }),
          reference_code: Type.Optional(Type.String({ maxLength: 200 })),
        },
        strict,
      ),
      { minItems: 1, maxItems: 10 },
    ),
  },
  strict,
);

export const CorporateAccountInputSchema = Type.Object(
  {
    legal_name: Type.String({ minLength: 2, maxLength: 200 }),
    tax_id: Type.String({ minLength: 3, maxLength: 40 }),
    billing_email: Type.Optional(Type.String({ format: "email" })),
    billing_phone: Type.Optional(Type.String({ maxLength: 40 })),
    currency: Type.String({ minLength: 3, maxLength: 3 }),
    credit_limit: Type.Number({ minimum: 0 }),
    payment_term_days: Type.Integer({ minimum: 0, maximum: 365 }),
    covered_category_ids: Type.Array(uuid()),
    covers_maintenance: Type.Boolean(),
    active: Type.Boolean(),
  },
  strict,
);
export type CorporateAccountInput = Static<typeof CorporateAccountInputSchema>;
export const CorporateCreditAuthorizationInputSchema = Type.Object(
  {
    stay_id: uuid(),
    corporate_account_id: uuid(),
    amount_limit: Type.Number({ exclusiveMinimum: 0 }),
    covered_category_ids: Type.Array(uuid()),
    covers_maintenance: Type.Boolean(),
    expires_at: dateTime(),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  strict,
);
export const CorporateCreditActionSchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("submit"),
      Type.Literal("approve"),
      Type.Literal("reject"),
      Type.Literal("revoke"),
    ]),
    expected_version: Type.Integer({ minimum: 0 }),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  strict,
);

export const BenefitPlanInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 2, maxLength: 160 }),
    description: Type.Optional(Type.String({ maxLength: 1000 })),
  },
  strict,
);
export const BenefitPlanVersionInputSchema = Type.Object(
  {
    allowance_scope: Type.Union([
      Type.Literal("stay"),
      Type.Literal("night"),
      Type.Literal("calendar_day"),
    ]),
    activate: Type.Boolean(),
    rules: Type.Array(
      Type.Object(
        {
          kind: Type.Union([
            Type.Literal("included_item"),
            Type.Literal("monetary_credit"),
          ]),
          product_id: Type.Optional(uuid()),
          category_id: Type.Optional(uuid()),
          offer_id: Type.Optional(uuid()),
          point_id: Type.Optional(uuid()),
          quantity: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
          amount: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
        },
        strict,
      ),
      { minItems: 1 },
    ),
  },
  strict,
);
export type BenefitPlanVersionInput = Static<
  typeof BenefitPlanVersionInputSchema
>;
export const BenefitGrantInputSchema = Type.Object(
  {
    plan_version_id: uuid(),
    expires_at: Type.Optional(dateTime()),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  strict,
);

export type BenefitCandidate = {
  id: string;
  availableAmount: number;
  expiresAt: string | null;
  grantedAt: string;
};
export function maximizeBenefit(
  grossAmount: number,
  candidates: BenefitCandidate[],
): Array<{ id: string; amount: number }> {
  let remaining = Math.max(0, Math.round(grossAmount * 100));
  return [...candidates]
    .sort((left, right) => {
      const expiry =
        (left.expiresAt ?? "9999-12-31").localeCompare(
          right.expiresAt ?? "9999-12-31",
        ) || left.grantedAt.localeCompare(right.grantedAt);
      return expiry || left.id.localeCompare(right.id);
    })
    .flatMap((candidate) => {
      const amount = Math.min(
        remaining,
        Math.max(0, Math.round(candidate.availableAmount * 100)),
      );
      remaining -= amount;
      return amount ? [{ id: candidate.id, amount: amount / 100 }] : [];
    });
}

export function validatePayerAllocation(
  expectedAmount: number,
  allocations: Array<{ amount: number }>,
): { valid: boolean; allocatedAmount: number; difference: number } {
  const expected = Math.round(expectedAmount * 100);
  const allocated = allocations.reduce(
    (sum, item) => sum + Math.round(item.amount * 100),
    0,
  );
  return {
    valid:
      expected === allocated && allocations.every((item) => item.amount > 0),
    allocatedAmount: allocated / 100,
    difference: (expected - allocated) / 100,
  };
}

export const ConsumptionTransferInputSchema = Type.Object(
  {
    destination_stay_id: uuid(),
    guest_customer_id: uuid(),
    payer_account_id: uuid(),
    expected_source_version: Type.Integer({ minimum: 0 }),
    expected_destination_version: Type.Integer({ minimum: 0 }),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
    items: Type.Array(
      Type.Object(
        {
          order_item_id: uuid(),
          quantity: Type.Number({ exclusiveMinimum: 0 }),
        },
        strict,
      ),
      { minItems: 1 },
    ),
  },
  strict,
);

export const PostCheckoutCaseStatusSchema = Type.Union([
  Type.Literal("draft"),
  Type.Literal("submitted"),
  Type.Literal("approved"),
  Type.Literal("collection_pending"),
  Type.Literal("disputed"),
  Type.Literal("partially_paid"),
  Type.Literal("paid"),
  Type.Literal("waived"),
  Type.Literal("rejected"),
  Type.Literal("canceled"),
]);
export const PostCheckoutConsumptionCreateSchema = Type.Object(
  {
    stay_id: uuid(),
    occurred_at: dateTime(),
    report: Type.String({ minLength: 3, maxLength: 2000 }),
    governance_inspection_id: Type.Optional(uuid()),
    items: Type.Array(ConsumptionServiceItemInputSchema, { minItems: 1 }),
  },
  strict,
);
export const PostCheckoutConsumptionActionSchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("submit"),
      Type.Literal("approve"),
      Type.Literal("reject"),
      Type.Literal("record_contact"),
      Type.Literal("dispute"),
      Type.Literal("resume_collection"),
      Type.Literal("waive"),
      Type.Literal("cancel"),
    ]),
    expected_version: Type.Integer({ minimum: 0 }),
    reason: Type.String({ minLength: 3, maxLength: 2000 }),
    result: Type.Optional(Type.String({ maxLength: 1000 })),
    promised_at: Type.Optional(dateTime()),
  },
  strict,
);
export const PostCheckoutPaymentInputSchema = Type.Object(
  {
    idempotency_key: uuid(),
    expected_version: Type.Integer({ minimum: 0 }),
    tenders: Type.Array(
      Type.Object(
        {
          payment_method: Type.String({ minLength: 1, maxLength: 40 }),
          amount: Type.Number({ exclusiveMinimum: 0 }),
          reference_code: Type.Optional(Type.String({ maxLength: 200 })),
        },
        strict,
      ),
      { minItems: 1 },
    ),
  },
  strict,
);

export const DepartureReviewSchema = Type.Object(
  {
    stay_id: uuid(),
    ready: Type.Boolean(),
    blockers: Type.Array(
      Type.Object(
        {
          type: Type.String(),
          label: Type.String(),
          responsible_id: Type.Union([uuid(), Type.Null()]),
          updated_at: dateTime(),
          action: Type.String(),
        },
        strict,
      ),
    ),
    payer_balances: Type.Array(Type.Ref("StayPayerAccount")),
    account_version: Type.Integer(),
    updated_at: dateTime(),
  },
  { ...strict, $id: "DepartureReview" },
);
