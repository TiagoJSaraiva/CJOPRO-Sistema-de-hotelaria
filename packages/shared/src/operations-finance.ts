import { Type, type Static } from "typebox";

const strict = { additionalProperties: false } as const;
const uuid = () => Type.String({ format: "uuid" });
const date = () => Type.String({ format: "date" });
const dateTime = () => Type.String({ format: "date-time" });

export const OrganizationInputSchema = Type.Object(
  {
    legal_name: Type.String({ minLength: 2, maxLength: 200 }),
    trade_name: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
    tax_id: Type.Optional(Type.String({ minLength: 3, maxLength: 40 })),
    currency: Type.String({ minLength: 3, maxLength: 3 }),
    email: Type.Optional(Type.String({ format: "email" })),
    phone: Type.Optional(Type.String({ maxLength: 40 })),
    active: Type.Boolean(),
    roles: Type.Optional(
      Type.Array(
        Type.Union([
          Type.Literal("stock_supplier"),
          Type.Literal("commercial_partner"),
          Type.Literal("maintenance_supplier"),
          Type.Literal("corporate_account"),
        ]),
        { uniqueItems: true },
      ),
    ),
  },
  strict,
);
export type OrganizationInput = Static<typeof OrganizationInputSchema>;

export const OrganizationActionSchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("merge"),
      Type.Literal("split"),
      Type.Literal("resolve_conflict"),
    ]),
    expected_version: Type.Integer({ minimum: 1 }),
    target_id: Type.Optional(uuid()),
    role_type: Type.Optional(
      Type.Union([
        Type.Literal("commercial_partner"),
        Type.Literal("maintenance_supplier"),
        Type.Literal("corporate_account"),
        Type.Literal("stock_supplier"),
      ]),
    ),
    role_id: Type.Optional(uuid()),
    conflict_id: Type.Optional(uuid()),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  strict,
);
export type OrganizationAction = Static<typeof OrganizationActionSchema>;

export const ProcurementPolicyInputSchema = Type.Object(
  {
    currency: Type.String({ minLength: 3, maxLength: 3 }),
    price_tolerance_percent: Type.Number({ minimum: 0, maximum: 100 }),
    price_tolerance_amount: Type.Number({ minimum: 0 }),
    quantity_tolerance_percent: Type.Number({ minimum: 0, maximum: 100 }),
    quantity_tolerance_amount: Type.Number({ minimum: 0 }),
    tiers: Type.Array(
      Type.Object(
        {
          minimum_amount: Type.Number({ minimum: 0 }),
          maximum_amount: Type.Union([
            Type.Number({ exclusiveMinimum: 0 }),
            Type.Null(),
          ]),
          approvals_required: Type.Union([Type.Literal(1), Type.Literal(2)]),
          quotes_required: Type.Integer({ minimum: 0, maximum: 10 }),
        },
        strict,
      ),
      { minItems: 1, maxItems: 20 },
    ),
  },
  strict,
);
export type ProcurementPolicyInput = Static<
  typeof ProcurementPolicyInputSchema
>;

export const ReplenishmentRequestInputSchema = Type.Object(
  {
    product_id: uuid(),
    location_id: uuid(),
    requested_quantity: Type.Number({ exclusiveMinimum: 0 }),
    priority: Type.Union([
      Type.Literal("low"),
      Type.Literal("normal"),
      Type.Literal("high"),
      Type.Literal("critical"),
    ]),
    need_by: Type.Optional(date()),
    preferred_supplier_id: Type.Optional(uuid()),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  strict,
);
export type ReplenishmentRequestInput = Static<
  typeof ReplenishmentRequestInputSchema
>;

export const ReplenishmentActionSchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("submit"),
      Type.Literal("approve"),
      Type.Literal("cancel"),
      Type.Literal("fulfill"),
    ]),
    expected_version: Type.Integer({ minimum: 1 }),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  strict,
);
export type ReplenishmentAction = Static<typeof ReplenishmentActionSchema>;

export const PurchaseOrderInputSchema = Type.Object(
  {
    supplier_id: uuid(),
    destination_location_id: uuid(),
    currency: Type.String({ minLength: 3, maxLength: 3 }),
    expected_on: Type.Optional(date()),
    notes: Type.Optional(Type.String({ maxLength: 2000 })),
    replenishment_request_ids: Type.Array(uuid(), { maxItems: 100 }),
    quotes: Type.Array(
      Type.Object(
        {
          supplier_id: uuid(),
          amount: Type.Number({ minimum: 0 }),
          reference: Type.Optional(Type.String({ maxLength: 160 })),
        },
        strict,
      ),
      { maxItems: 20 },
    ),
    lines: Type.Array(
      Type.Object(
        {
          product_id: uuid(),
          quantity: Type.Number({ exclusiveMinimum: 0 }),
          unit_price: Type.Number({ minimum: 0 }),
          tax_amount: Type.Number({ minimum: 0 }),
        },
        strict,
      ),
      { minItems: 1, maxItems: 200 },
    ),
  },
  strict,
);
export type PurchaseOrderInput = Static<typeof PurchaseOrderInputSchema>;

export const VersionedReasonActionSchema = Type.Object(
  {
    action: Type.String({ minLength: 2, maxLength: 40 }),
    expected_version: Type.Integer({ minimum: 1 }),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
    idempotency_key: Type.Optional(uuid()),
  },
  strict,
);
export type VersionedReasonAction = Static<typeof VersionedReasonActionSchema>;

export const PurchaseReceiptInputSchema = Type.Object(
  {
    expected_version: Type.Integer({ minimum: 1 }),
    occurred_at: dateTime(),
    reference_code: Type.Optional(Type.String({ maxLength: 120 })),
    notes: Type.Optional(Type.String({ maxLength: 1000 })),
    idempotency_key: uuid(),
    lines: Type.Array(
      Type.Object(
        {
          order_line_id: uuid(),
          accepted_quantity: Type.Number({ minimum: 0 }),
          rejected_quantity: Type.Number({ minimum: 0 }),
          unit_cost: Type.Number({ minimum: 0 }),
          lot_code: Type.Optional(Type.String({ maxLength: 120 })),
          expires_on: Type.Optional(date()),
          evidence_path: Type.Optional(Type.String({ maxLength: 500 })),
        },
        strict,
      ),
      { minItems: 1, maxItems: 200 },
    ),
  },
  strict,
);
export type PurchaseReceiptInput = Static<typeof PurchaseReceiptInputSchema>;

export const ProcurementInvoiceInputSchema = Type.Object(
  {
    purchase_order_id: uuid(),
    invoice_number: Type.String({ minLength: 1, maxLength: 120 }),
    issued_on: date(),
    due_dates: Type.Array(date(), { minItems: 1, maxItems: 60 }),
    total_amount: Type.Number({ exclusiveMinimum: 0 }),
    evidence_path: Type.Optional(Type.String({ maxLength: 500 })),
    idempotency_key: uuid(),
  },
  strict,
);
export type ProcurementInvoiceInput = Static<
  typeof ProcurementInvoiceInputSchema
>;

export const PaymentInputSchema = Type.Object(
  {
    expected_version: Type.Integer({ minimum: 1 }),
    idempotency_key: uuid(),
    paid_at: Type.Optional(dateTime()),
    cash_session_id: Type.Optional(uuid()),
    tenders: Type.Array(
      Type.Object(
        {
          payment_method: Type.String({ minLength: 1, maxLength: 40 }),
          amount: Type.Number({ exclusiveMinimum: 0 }),
          reference_code: Type.Optional(Type.String({ maxLength: 160 })),
        },
        strict,
      ),
      { minItems: 1, maxItems: 10 },
    ),
    notes: Type.Optional(Type.String({ maxLength: 1000 })),
  },
  strict,
);
export type PaymentInput = Static<typeof PaymentInputSchema>;

export const LotTrackingInputSchema = Type.Object(
  {
    mode: Type.Union([
      Type.Literal("none"),
      Type.Literal("lot"),
      Type.Literal("lot_expiry"),
    ]),
    expiry_alert_days: Type.Integer({ minimum: 1, maximum: 365 }),
    initial_lots: Type.Array(
      Type.Object(
        {
          position_id: uuid(),
          lot_code: Type.String({ minLength: 1, maxLength: 120 }),
          expires_on: Type.Optional(date()),
          quantity: Type.Number({ exclusiveMinimum: 0 }),
        },
        strict,
      ),
      { maxItems: 500 },
    ),
  },
  strict,
);
export type LotTrackingInput = Static<typeof LotTrackingInputSchema>;

export const LotActionSchema = Type.Object(
  {
    action: Type.Union([Type.Literal("discard"), Type.Literal("adjust")]),
    position_id: uuid(),
    quantity: Type.Number({ exclusiveMinimum: 0 }),
    expected_version: Type.Integer({ minimum: 1 }),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
    idempotency_key: uuid(),
  },
  strict,
);
export type LotAction = Static<typeof LotActionSchema>;

export const MinibarCompositionInputSchema = Type.Object(
  {
    room_type: Type.String({ minLength: 1, maxLength: 120 }),
    name: Type.String({ minLength: 2, maxLength: 160 }),
  },
  strict,
);
export type MinibarCompositionInput = Static<
  typeof MinibarCompositionInputSchema
>;
export const MinibarCompositionVersionInputSchema = Type.Object(
  {
    activate: Type.Boolean(),
    items: Type.Array(
      Type.Object(
        {
          product_id: uuid(),
          source_location_id: uuid(),
          ideal_quantity: Type.Number({ minimum: 0 }),
        },
        strict,
      ),
      { minItems: 1, maxItems: 100 },
    ),
  },
  strict,
);
export type MinibarCompositionVersionInput = Static<
  typeof MinibarCompositionVersionInputSchema
>;

export const MinibarRouteInputSchema = Type.Object(
  {
    room_ids: Type.Array(uuid(), { minItems: 1, maxItems: 200 }),
    expected_board_version: Type.Integer({ minimum: 0 }),
    idempotency_key: uuid(),
  },
  strict,
);
export type MinibarRouteInput = Static<typeof MinibarRouteInputSchema>;

export const CashRegisterInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 2, maxLength: 120 }),
    code: Type.String({ minLength: 1, maxLength: 40 }),
    kind: Type.Union([Type.Literal("reception"), Type.Literal("consumption")]),
    consumption_point_id: Type.Optional(uuid()),
    currency: Type.String({ minLength: 3, maxLength: 3 }),
    difference_tolerance: Type.Number({ minimum: 0 }),
    active: Type.Boolean(),
  },
  strict,
);
export type CashRegisterInput = Static<typeof CashRegisterInputSchema>;

export const CashSessionOpenSchema = Type.Object(
  {
    opening_float: Type.Number({ minimum: 0 }),
    idempotency_key: uuid(),
  },
  strict,
);
export type CashSessionOpen = Static<typeof CashSessionOpenSchema>;
export const CashSessionActionSchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("count"),
      Type.Literal("approve_difference"),
      Type.Literal("request_recount"),
      Type.Literal("handoff"),
      Type.Literal("cancel"),
    ]),
    expected_version: Type.Integer({ minimum: 1 }),
    counted_amount: Type.Optional(Type.Number({ minimum: 0 })),
    next_operator_id: Type.Optional(uuid()),
    reason: Type.Optional(Type.String({ minLength: 3, maxLength: 1000 })),
    idempotency_key: uuid(),
  },
  strict,
);
export type CashSessionAction = Static<typeof CashSessionActionSchema>;
export const CashMovementInputSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("cash_in"),
      Type.Literal("cash_out"),
      Type.Literal("deposit"),
      Type.Literal("adjustment"),
    ]),
    amount: Type.Number({ exclusiveMinimum: 0 }),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
    idempotency_key: uuid(),
  },
  strict,
);
export type CashMovementInput = Static<typeof CashMovementInputSchema>;

export const DailyClosePrepareSchema = Type.Object(
  {
    expected_version: Type.Integer({ minimum: 0 }),
    accepted_pending: Type.Array(
      Type.Object(
        {
          pending_id: uuid(),
          responsible_id: uuid(),
          next_action: Type.String({ minLength: 3, maxLength: 500 }),
          reason: Type.String({ minLength: 3, maxLength: 1000 }),
        },
        strict,
      ),
      { maxItems: 200 },
    ),
  },
  strict,
);
export type DailyClosePrepare = Static<typeof DailyClosePrepareSchema>;
export const DailyCloseActionSchema = Type.Object(
  {
    action: Type.Union([Type.Literal("approve"), Type.Literal("reject")]),
    expected_version: Type.Integer({ minimum: 1 }),
    expected_fingerprint: Type.String({ minLength: 1, maxLength: 200 }),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
  },
  strict,
);
export type DailyCloseAction = Static<typeof DailyCloseActionSchema>;

export const PartnerDisputeInputSchema = Type.Object(
  {
    component_id: uuid(),
    disputed_amount: Type.Number({ exclusiveMinimum: 0 }),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
    evidence_path: Type.Optional(Type.String({ maxLength: 500 })),
  },
  strict,
);
export type PartnerDisputeInput = Static<typeof PartnerDisputeInputSchema>;

export type ApprovalTier = {
  minimumAmount: number;
  maximumAmount: number | null;
  approvalsRequired: 1 | 2;
  quotesRequired: number;
};

export function normalizeTaxId(
  value: string | null | undefined,
): string | null {
  const normalized = value?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() ?? "";
  return normalized || null;
}

export function approvalRequirement(amount: number, tiers: ApprovalTier[]) {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const ordered = [...tiers].sort((a, b) => a.minimumAmount - b.minimumAmount);
  return (
    ordered.find(
      (tier) =>
        amount >= tier.minimumAmount &&
        (tier.maximumAmount === null || amount <= tier.maximumAmount),
    ) ?? null
  );
}

export function classifyVariance(
  expected: number,
  actual: number,
  percentTolerance: number,
  absoluteTolerance: number,
) {
  const difference = Math.abs(actual - expected);
  const allowed = Math.max(
    Math.max(0, absoluteTolerance),
    Math.abs(expected) * (Math.max(0, percentTolerance) / 100),
  );
  return { difference, allowed, withinTolerance: difference <= allowed };
}

export type FefoLot = {
  id: string;
  available: number;
  expiresOn: string | null;
  receivedAt: string;
};
export function allocateFefo(quantity: number, lots: FefoLot[]) {
  let remaining = quantity;
  const allocations: Array<{ lotId: string; quantity: number }> = [];
  for (const lot of [...lots].sort((a, b) => {
    const expiry = (a.expiresOn ?? "9999-12-31").localeCompare(
      b.expiresOn ?? "9999-12-31",
    );
    return (
      expiry ||
      a.receivedAt.localeCompare(b.receivedAt) ||
      a.id.localeCompare(b.id)
    );
  })) {
    if (remaining <= 0) break;
    const allocated = Math.min(remaining, Math.max(0, lot.available));
    if (allocated > 0) allocations.push({ lotId: lot.id, quantity: allocated });
    remaining -= allocated;
  }
  return { allocations, remaining: Math.max(0, remaining) };
}

export function cashDifference(
  expected: number,
  counted: number,
  tolerance: number,
) {
  const difference = Math.round((counted - expected) * 100) / 100;
  return {
    difference,
    requiresApproval: Math.abs(difference) > Math.max(0, tolerance),
  };
}

export function availablePartnerBalance(
  approvedAmount: number,
  disputedAmount: number,
  paidAmount: number,
) {
  return Math.max(
    0,
    Math.round((approvedAmount - disputedAmount - paidAmount) * 100) / 100,
  );
}
