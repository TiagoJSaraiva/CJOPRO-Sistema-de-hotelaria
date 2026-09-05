import { Type, type Static, type TSchema } from "typebox";
import type {
  AdminCustomerCreateInput,
  AdminConsumptionOfferBatchInput,
  AdminConsumptionPointInput,
  AdminConsumptionReorderInput,
  AdminCommercialAgreementCreateInput,
  AdminCommercialPartnerInput,
  AdminCommercialPartnerContactInput,
  AdminFinancialTransactionCreateInput,
  AdminHotelCreateInput,
  AdminMaintenanceOccurrenceCreateInput,
  AdminMaintenanceCostItemInput,
  AdminMaintenanceRecoveryInput,
  AdminMaintenanceWorkOrderCreateInput,
  AdminPermissionCreateInput,
  AdminProductCreateInput,
  AdminReservationCalendarBookingCreateInput,
  AdminRoleCreateInput,
  AdminRoomCreateInput,
  AdminSeasonCreateInput,
  AdminSeasonRoomRateCreateInput,
  AdminStayRefundInput,
  AdminConsumptionCorrectionDecisionInput,
  AdminPartnerRefundConfirmationInput,
  AdminStayPaymentCreateInput,
  AdminUserCreateInput,
  LoginRequest,
} from "./index";

const strict = { additionalProperties: false } as const;
const nullable = <T extends TSchema>(schema: T) =>
  Type.Union([schema, Type.Null()]);
const optionalNullable = <T extends TSchema>(schema: T) =>
  Type.Optional(nullable(schema));
const uuid = () => Type.String({ format: "uuid" });
const date = () => Type.String({ format: "date" });
const dateTime = () => Type.String({ format: "date-time" });

export const ApiErrorSchema = Type.Object(
  {
    code: Type.Optional(Type.String()),
    message: Type.String(),
    details: Type.Optional(Type.String()),
    retryAfterSeconds: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { ...strict, $id: "ApiError" },
);

export const LoginBodySchema = Type.Object(
  {
    email: Type.String({ format: "email" }),
    password: Type.String({ minLength: 1 }),
  },
  { ...strict, $id: "LoginBody" },
);

export const HotelBodySchema = Type.Object(
  {
    name: Type.String(),
    legal_name: Type.String(),
    tax_id: Type.String(),
    slug: Type.String(),
    email: Type.String({ format: "email" }),
    phone: Type.String(),
    address_line: Type.String(),
    address_number: Type.String(),
    address_complement: nullable(Type.String()),
    district: Type.String(),
    city: Type.String(),
    state: Type.String(),
    country: Type.String(),
    zip_code: Type.String(),
    timezone: nullable(Type.String()),
    currency: nullable(Type.String()),
    checkin_time_start: optionalNullable(Type.String()),
    checkin_time_limit: optionalNullable(Type.String()),
    checkout_time_start: optionalNullable(Type.String()),
    checkout_time_limit: optionalNullable(Type.String()),
  },
  { ...strict, $id: "HotelCreateInput" },
);
export const HotelUpdateSchema = Type.Partial(
  Type.Object(
    {
      name: Type.String(),
      legal_name: Type.String(),
      tax_id: Type.String(),
      slug: Type.String(),
      email: nullable(Type.String({ format: "email" })),
      phone: nullable(Type.String()),
      address_line: nullable(Type.String()),
      address_number: nullable(Type.String()),
      address_complement: nullable(Type.String()),
      district: nullable(Type.String()),
      city: nullable(Type.String()),
      state: nullable(Type.String()),
      country: nullable(Type.String()),
      zip_code: nullable(Type.String()),
      timezone: nullable(Type.String()),
      currency: nullable(Type.String()),
      checkin_time_start: nullable(Type.String()),
      checkin_time_limit: nullable(Type.String()),
      checkout_time_start: nullable(Type.String()),
      checkout_time_limit: nullable(Type.String()),
      is_active: Type.Boolean(),
    },
    strict,
  ),
  { $id: "HotelUpdateInput" },
);

const RoleAssignmentSchema = Type.Object(
  { role_id: uuid(), hotel_id: nullable(uuid()) },
  strict,
);
export const UserBodySchema = Type.Object(
  {
    name: Type.String(),
    email: Type.String({ format: "email" }),
    password_hash: Type.String({ minLength: 1 }),
    role_assignments: Type.Array(RoleAssignmentSchema),
  },
  { ...strict, $id: "UserCreateInput" },
);
export const UserUpdateSchema = Type.Partial(
  Type.Object(
    {
      name: Type.String(),
      email: Type.String({ format: "email" }),
      password_hash: Type.String({ minLength: 1 }),
      is_active: Type.Boolean(),
      role_assignments: Type.Array(RoleAssignmentSchema),
    },
    strict,
  ),
  { $id: "UserUpdateInput" },
);

const RoleTypeSchema = Type.Union([
  Type.Literal("SYSTEM_ROLE"),
  Type.Literal("HOTEL_ROLE"),
]);
const PermissionTypeSchema = Type.Union([
  Type.Literal("SYSTEM_PERMISSION"),
  Type.Literal("HOTEL_PERMISSION"),
]);
export const RoleBodySchema = Type.Object(
  {
    name: Type.String(),
    role_type: RoleTypeSchema,
    hotel_id: nullable(uuid()),
    permission_ids: Type.Array(uuid()),
  },
  { ...strict, $id: "RoleCreateInput" },
);
export const RoleUpdateSchema = Type.Partial(
  Type.Object(
    {
      name: Type.String(),
      role_type: RoleTypeSchema,
      hotel_id: nullable(uuid()),
      permission_ids: Type.Array(uuid()),
    },
    strict,
  ),
  { $id: "RoleUpdateInput" },
);
export const PermissionBodySchema = Type.Object(
  { name: Type.String(), type: PermissionTypeSchema },
  { ...strict, $id: "PermissionCreateInput" },
);
export const PermissionUpdateSchema = Type.Partial(PermissionBodySchema, {
  $id: "PermissionUpdateInput",
});

const RoomStatusSchema = Type.Union([
  Type.Literal("available"),
  Type.Literal("occupied"),
  Type.Literal("maintenance"),
  Type.Literal("blocked"),
]);
export const RoomBodySchema = Type.Object(
  {
    room_number: Type.String(),
    room_type: Type.String(),
    max_occupancy: Type.Integer({ minimum: 1 }),
    base_daily_rate: Type.Number({ minimum: 0 }),
    status: Type.Optional(RoomStatusSchema),
    notes: optionalNullable(Type.String()),
  },
  { ...strict, $id: "RoomCreateInput" },
);
export const RoomUpdateSchema = Type.Partial(RoomBodySchema, {
  $id: "RoomUpdateInput",
});

export const CustomerBodySchema = Type.Object(
  {
    full_name: Type.String(),
    document_number: Type.String(),
    document_type: Type.String(),
    email: optionalNullable(Type.String({ format: "email" })),
    mobile_phone: optionalNullable(Type.String()),
    phone: optionalNullable(Type.String()),
    birth_date: date(),
    nationality: optionalNullable(Type.String()),
    notes: optionalNullable(Type.String()),
  },
  { ...strict, $id: "CustomerCreateInput" },
);
export const CustomerUpdateSchema = Type.Partial(CustomerBodySchema, {
  $id: "CustomerUpdateInput",
});

const ProductStatusSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("inactive"),
]);
const ProductKindSchema = Type.Union([
  Type.Literal("physical"),
  Type.Literal("service"),
]);
const ProductSalesUnitSchema = Type.Union([
  Type.Literal("unit"),
  Type.Literal("portion"),
  Type.Literal("person"),
  Type.Literal("hour"),
  Type.Literal("daily"),
  Type.Literal("service"),
]);
export const ProductCategoryBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    display_order: Type.Optional(Type.Integer({ minimum: 0 })),
    is_active: Type.Optional(Type.Boolean()),
  },
  { ...strict, $id: "ProductCategoryInput" },
);
export const ProductCategoryUpdateSchema = Type.Partial(
  ProductCategoryBodySchema,
  { $id: "ProductCategoryUpdateInput" },
);
const productCommon = {
  name: Type.String({ minLength: 1, maxLength: 160 }),
  category_id: uuid(),
  description: optionalNullable(Type.String({ maxLength: 1000 })),
  internal_code: optionalNullable(Type.String({ minLength: 1, maxLength: 80 })),
  kind: ProductKindSchema,
  sales_unit: ProductSalesUnitSchema,
  unit_price: Type.Number({ minimum: 0 }),
  status: Type.Optional(ProductStatusSchema),
};
export const ProductBodySchema = Type.Union(
  [
    Type.Object(
      {
        ...productCommon,
        provider_type: Type.Optional(Type.Literal("hotel")),
        commercial_partner_id: Type.Optional(Type.Null()),
      },
      strict,
    ),
    Type.Object(
      {
        ...productCommon,
        provider_type: Type.Literal("partner"),
        commercial_partner_id: uuid(),
      },
      strict,
    ),
  ],
  { $id: "ProductCreateInput" },
);
export const ProductUpdateSchema = Type.Partial(
  Type.Object(productCommon, strict),
  { ...strict, $id: "ProductUpdateInput" },
);

const CommercialContactPurposeSchema = Type.Union([
  Type.Literal("operational"),
  Type.Literal("financial"),
  Type.Literal("general"),
]);
const CommercialModelSchema = Type.Union([
  Type.Literal("fixed_rent"),
  Type.Literal("revenue_share"),
  Type.Literal("hybrid"),
]);
const CommercialRentFrequencySchema = Type.Union([
  Type.Literal("monthly"),
  Type.Literal("quarterly"),
  Type.Literal("yearly"),
]);
const CommercialPaymentRecipientSchema = Type.Union([
  Type.Literal("hotel"),
  Type.Literal("partner"),
  Type.Literal("both"),
]);
export const CommercialPartnerBodySchema = Type.Object(
  {
    trade_name: Type.String({ minLength: 1, maxLength: 160 }),
    legal_name: Type.String({ minLength: 1, maxLength: 200 }),
    tax_id: optionalNullable(Type.String({ minLength: 3, maxLength: 40 })),
    email: optionalNullable(Type.String({ format: "email", maxLength: 254 })),
    phone: optionalNullable(Type.String({ maxLength: 40 })),
    notes: optionalNullable(Type.String({ maxLength: 2000 })),
    is_active: Type.Optional(Type.Boolean()),
  },
  { ...strict, $id: "CommercialPartnerInput" },
);
export const CommercialPartnerUpdateSchema = Type.Partial(
  CommercialPartnerBodySchema,
  { $id: "CommercialPartnerUpdateInput" },
);
export const CommercialPartnerContactBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 160 }),
    role: optionalNullable(Type.String({ maxLength: 120 })),
    purpose: CommercialContactPurposeSchema,
    email: optionalNullable(Type.String({ format: "email", maxLength: 254 })),
    phone: optionalNullable(Type.String({ maxLength: 40 })),
    is_primary: Type.Optional(Type.Boolean()),
    is_active: Type.Optional(Type.Boolean()),
  },
  { ...strict, $id: "CommercialPartnerContactInput" },
);
export const CommercialPartnerContactUpdateSchema = Type.Partial(
  CommercialPartnerContactBodySchema,
  { $id: "CommercialPartnerContactUpdateInput" },
);
const commercialRevisionCommon = {
  starts_on: date(),
  ends_on: optionalNullable(date()),
  payment_recipient: CommercialPaymentRecipientSchema,
  notes: optionalNullable(Type.String({ maxLength: 2000 })),
  point_ids: Type.Array(uuid(), { minItems: 1, uniqueItems: true }),
};
export const CommercialAgreementRevisionBodySchema = Type.Union(
  [
    Type.Object(
      {
        ...commercialRevisionCommon,
        commercial_model: Type.Literal("fixed_rent"),
        fixed_rent: Type.Number({ minimum: 0 }),
        rent_frequency: CommercialRentFrequencySchema,
        commission_percentage: Type.Optional(Type.Null()),
        minimum_guarantee: Type.Optional(Type.Null()),
      },
      strict,
    ),
    Type.Object(
      {
        ...commercialRevisionCommon,
        commercial_model: Type.Literal("revenue_share"),
        fixed_rent: Type.Optional(Type.Null()),
        rent_frequency: Type.Optional(Type.Null()),
        commission_percentage: Type.Number({ minimum: 0, maximum: 100 }),
        minimum_guarantee: Type.Optional(Type.Null()),
      },
      strict,
    ),
    Type.Object(
      {
        ...commercialRevisionCommon,
        commercial_model: Type.Literal("hybrid"),
        fixed_rent: Type.Number({ minimum: 0 }),
        rent_frequency: CommercialRentFrequencySchema,
        commission_percentage: Type.Number({ minimum: 0, maximum: 100 }),
        minimum_guarantee: optionalNullable(Type.Number({ minimum: 0 })),
      },
      strict,
    ),
  ],
  { $id: "CommercialAgreementRevisionInput" },
);
export const CommercialAgreementRevisionUpdateSchema = Type.Partial(
  CommercialAgreementRevisionBodySchema,
  { $id: "CommercialAgreementRevisionUpdateInput" },
);
export const CommercialAgreementBodySchema = Type.Object(
  {
    partner_id: uuid(),
    internal_number: Type.String({ minLength: 1, maxLength: 80 }),
    revision: CommercialAgreementRevisionBodySchema,
  },
  { ...strict, $id: "CommercialAgreementCreateInput" },
);
export const CommercialAgreementTerminateBodySchema = Type.Object(
  { ends_on: date() },
  { ...strict, $id: "CommercialAgreementTerminateInput" },
);
export const CommercialAgreementPointsBodySchema = Type.Object(
  { point_ids: Type.Array(uuid(), { minItems: 1, uniqueItems: true }) },
  { ...strict, $id: "CommercialAgreementPointsInput" },
);

const ConsumptionBillingModeSchema = Type.Union([
  Type.Literal("hotel_immediate"),
  Type.Literal("stay_folio"),
  Type.Literal("partner_direct"),
]);
const ConsumptionPolicySourceSchema = Type.Union([
  Type.Literal("inherit"),
  Type.Literal("override"),
]);
export const ConsumptionBillingPolicySchema = Type.Object(
  {
    allowed_modes: Type.Array(ConsumptionBillingModeSchema, {
      minItems: 1,
      uniqueItems: true,
    }),
    default_mode: ConsumptionBillingModeSchema,
  },
  { ...strict, $id: "ConsumptionBillingPolicy" },
);
export const ConsumptionPointBillingPolicySchema = Type.Object(
  {
    allowed_modes: Type.Array(
      Type.Union([Type.Literal("hotel_immediate"), Type.Literal("stay_folio")]),
      { minItems: 1, uniqueItems: true },
    ),
    default_mode: Type.Union([
      Type.Literal("hotel_immediate"),
      Type.Literal("stay_folio"),
    ]),
  },
  { ...strict, $id: "ConsumptionPointBillingPolicy" },
);
export const ConsumptionPointBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    internal_code: optionalNullable(
      Type.String({ minLength: 1, maxLength: 80 }),
    ),
    description: optionalNullable(Type.String({ maxLength: 1000 })),
    display_order: Type.Optional(Type.Integer({ minimum: 0 })),
    is_active: Type.Optional(Type.Boolean()),
    default_policy: ConsumptionPointBillingPolicySchema,
    default_inventory_location_id: optionalNullable(uuid()),
  },
  { ...strict, $id: "ConsumptionPointInput" },
);
export const ConsumptionPointUpdateSchema = Type.Partial(
  ConsumptionPointBodySchema,
  { $id: "ConsumptionPointUpdateInput" },
);
export const ConsumptionOfferPolicySchema = Type.Union(
  [
    Type.Object({ source: Type.Literal("inherit") }, strict),
    Type.Object(
      {
        source: Type.Literal("override"),
        allowed_modes: Type.Array(ConsumptionBillingModeSchema, {
          minItems: 1,
          uniqueItems: true,
        }),
        default_mode: ConsumptionBillingModeSchema,
      },
      strict,
    ),
  ],
  { $id: "ConsumptionOfferPolicyInput" },
);
export const ConsumptionOfferBatchBodySchema = Type.Object(
  {
    product_ids: Type.Array(uuid(), { minItems: 1, uniqueItems: true }),
    policy: ConsumptionOfferPolicySchema,
    commercial_agreement_id: optionalNullable(uuid()),
    inventory_location_id: optionalNullable(uuid()),
  },
  { ...strict, $id: "ConsumptionOfferBatchInput" },
);
export const ConsumptionOfferUpdateSchema = Type.Partial(
  Type.Object(
    {
      display_order: Type.Integer({ minimum: 0 }),
      is_active: Type.Boolean(),
      policy: ConsumptionOfferPolicySchema,
      commercial_agreement_id: optionalNullable(uuid()),
      inventory_location_id: optionalNullable(uuid()),
    },
    strict,
  ),
  { $id: "ConsumptionOfferUpdateInput" },
);
export const ConsumptionReorderBodySchema = Type.Object(
  { ids: Type.Array(uuid(), { uniqueItems: true }) },
  { ...strict, $id: "ConsumptionReorderInput" },
);

const ConsumptionOrderDispositionInputSchema = Type.Union([
  Type.Literal("charged"),
  Type.Literal("courtesy"),
]);
export const ConsumptionPaymentMethodSchema = Type.Union([
  Type.Literal("cash"),
  Type.Literal("pix"),
  Type.Literal("credit_card"),
  Type.Literal("debit_card"),
  Type.Literal("bank_transfer"),
]);
export const ConsumptionOrderLineBodySchema = Type.Object(
  {
    offer_id: uuid(),
    quantity: Type.Number({ exclusiveMinimum: 0, maximum: 9999 }),
    version_token: Type.String({ minLength: 1, maxLength: 128 }),
  },
  { ...strict, $id: "ConsumptionOrderLineInput" },
);
export const ConsumptionOrderBodySchema = Type.Object(
  {
    stay_id: uuid(),
    point_id: uuid(),
    guest_customer_id: optionalNullable(uuid()),
    occurred_at: dateTime(),
    disposition: ConsumptionOrderDispositionInputSchema,
    billing_mode: Type.Optional(nullable(ConsumptionBillingModeSchema)),
    payment_method: Type.Optional(nullable(ConsumptionPaymentMethodSchema)),
    payment_reference: optionalNullable(
      Type.String({ minLength: 1, maxLength: 120 }),
    ),
    partner_receipt_confirmed: Type.Optional(Type.Boolean()),
    courtesy_reason: optionalNullable(
      Type.String({ minLength: 3, maxLength: 1000 }),
    ),
    notes: optionalNullable(Type.String({ minLength: 1, maxLength: 1000 })),
    idempotency_key: uuid(),
    lines: Type.Array(ConsumptionOrderLineBodySchema, {
      minItems: 1,
      maxItems: 100,
    }),
  },
  { ...strict, $id: "ConsumptionOrderCreateInput" },
);

export const SeasonBodySchema = Type.Object(
  {
    name: Type.String(),
    start_date: date(),
    end_date: date(),
    is_active: Type.Optional(Type.Boolean()),
  },
  { ...strict, $id: "SeasonCreateInput" },
);
export const SeasonUpdateSchema = Type.Partial(SeasonBodySchema, {
  $id: "SeasonUpdateInput",
});
export const SeasonRoomRateBodySchema = Type.Object(
  {
    season_id: uuid(),
    room_type: Type.String(),
    daily_rate: Type.Number({ minimum: 0 }),
  },
  { ...strict, $id: "SeasonRoomRateCreateInput" },
);
export const SeasonRoomRateUpdateSchema = Type.Partial(
  SeasonRoomRateBodySchema,
  { $id: "SeasonRoomRateUpdateInput" },
);

const TransactionTypeSchema = Type.Union([
  Type.Literal("INCOME"),
  Type.Literal("EXPENSE"),
  Type.Literal("REFUND"),
]);
const TransactionStatusSchema = Type.Union([
  Type.Literal("PENDING"),
  Type.Literal("COMPLETED"),
  Type.Literal("FAILED"),
  Type.Literal("CANCELLED"),
  Type.Literal("REFUNDED"),
]);
export const FinancialTransactionBodySchema = Type.Object(
  {
    type: TransactionTypeSchema,
    category: Type.String(),
    amount: Type.Number({ minimum: 0 }),
    currency: Type.Optional(Type.String()),
    description: optionalNullable(Type.String()),
    status: Type.Optional(TransactionStatusSchema),
    stay_id: optionalNullable(uuid()),
    reservation_id: optionalNullable(uuid()),
    payment_method: optionalNullable(Type.String()),
    paid_at: optionalNullable(dateTime()),
    due_date: optionalNullable(date()),
    counterparty: optionalNullable(Type.String()),
    cost_center: optionalNullable(Type.String()),
    reference_code: optionalNullable(Type.String()),
  },
  { ...strict, $id: "FinancialTransactionCreateInput" },
);
export const FinancialTransactionUpdateSchema = Type.Partial(
  FinancialTransactionBodySchema,
  { $id: "FinancialTransactionUpdateInput" },
);

const ExistingCustomerSchema = Type.Object(
  { mode: Type.Literal("existing"), customer_id: uuid() },
  strict,
);
const InlineCustomerSchema = Type.Object(
  {
    mode: Type.Literal("create_inline"),
    full_name: Type.String(),
    document_number: Type.String(),
    document_type: Type.String(),
    birth_date: date(),
    email: optionalNullable(Type.String({ format: "email" })),
    mobile_phone: optionalNullable(Type.String()),
    phone: optionalNullable(Type.String()),
    nationality: optionalNullable(Type.String()),
    notes: optionalNullable(Type.String()),
  },
  strict,
);
const SelectedCellSchema = Type.Object(
  {
    room_id: uuid(),
    date: date(),
    side: Type.Union([
      Type.Literal("checkin"),
      Type.Literal("checkout"),
      Type.Literal("full"),
    ]),
  },
  strict,
);
export const CalendarBookingBodySchema = Type.Object(
  {
    booking_customer: Type.Union([
      ExistingCustomerSchema,
      InlineCustomerSchema,
    ]),
    selected_cells: Type.Array(SelectedCellSchema, { minItems: 1 }),
    reservation_source: optionalNullable(
      Type.Union([
        Type.Literal("front_desk"),
        Type.Literal("website"),
        Type.Literal("phone"),
        Type.Literal("agency"),
      ]),
    ),
    notes: optionalNullable(Type.String()),
  },
  { ...strict, $id: "CalendarBookingCreateInput" },
);
export const StayPaymentBodySchema = Type.Object(
  {
    amount: Type.Number({ exclusiveMinimum: 0 }),
    method: Type.String(),
    note: optionalNullable(Type.String()),
    paid_at: optionalNullable(dateTime()),
    allocations: Type.Optional(
      Type.Array(
        Type.Object(
          {
            debit_entry_id: uuid(),
            amount: Type.Number({ exclusiveMinimum: 0 }),
          },
          strict,
        ),
      ),
    ),
  },
  { ...strict, $id: "StayPaymentCreateInput" },
);

export const StayPaymentTenderBodySchema = Type.Object(
  {
    payment_method: ConsumptionPaymentMethodSchema,
    amount: Type.Number({ exclusiveMinimum: 0, maximum: 9999999999.99 }),
    reference_code: optionalNullable(
      Type.String({ minLength: 1, maxLength: 200 }),
    ),
  },
  { ...strict, $id: "StayPaymentTenderInput" },
);
export const StayPaymentBatchBodySchema = Type.Object(
  {
    tenders: Type.Array(Type.Ref("StayPaymentTenderInput"), {
      minItems: 1,
      maxItems: 10,
    }),
    expected_version: Type.Integer({ minimum: 0 }),
    idempotency_key: uuid(),
    note: optionalNullable(Type.String({ minLength: 1, maxLength: 1000 })),
  },
  { ...strict, $id: "StayPaymentBatchInput" },
);
export const StayPaymentBatchPreviewSchema = Type.Object(
  {
    currency: Type.String(),
    balance: Type.Number(),
    total: Type.Number(),
    remaining: Type.Number(),
    allocations: Type.Array(
      Type.Object(
        { debit_entry_id: uuid(), amount: Type.Number({ minimum: 0 }) },
        strict,
      ),
    ),
  },
  { ...strict, $id: "StayPaymentBatchPreview" },
);
export const ConsumptionCorrectionItemBodySchema = Type.Object(
  {
    order_item_id: uuid(),
    resulting_quantity: Type.Number({ minimum: 0, maximum: 9999 }),
    additional_discount: Type.Number({ minimum: 0, maximum: 9999999999.99 }),
    restock_quantity: Type.Optional(Type.Number({ minimum: 0, maximum: 9999 })),
    restock_location_id: optionalNullable(uuid()),
    inventory_version: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { ...strict, $id: "ConsumptionCorrectionItemInput" },
);

const InventoryNegativeStockPolicySchema = Type.Union([
  Type.Literal("allow_with_warning"),
  Type.Literal("block"),
]);
const InventoryMovementKindSchema = Type.Union([
  Type.Literal("opening"),
  Type.Literal("receipt"),
  Type.Literal("consumption"),
  Type.Literal("courtesy"),
  Type.Literal("return"),
  Type.Literal("transfer_out"),
  Type.Literal("transfer_in"),
  Type.Literal("loss"),
  Type.Literal("internal_use"),
  Type.Literal("adjustment_in"),
  Type.Literal("adjustment_out"),
  Type.Literal("count_gain"),
  Type.Literal("count_loss"),
]);
const InventoryDocumentKindSchema = Type.Union([
  Type.Literal("receipt"),
  Type.Literal("adjustment"),
  Type.Literal("loss"),
  Type.Literal("internal_use"),
]);
export const InventorySettingsBodySchema = Type.Object(
  { negative_stock_policy: InventoryNegativeStockPolicySchema },
  { ...strict, $id: "InventorySettingsInput" },
);
export const InventoryLocationBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    internal_code: optionalNullable(
      Type.String({ minLength: 1, maxLength: 60 }),
    ),
    description: optionalNullable(
      Type.String({ minLength: 1, maxLength: 1000 }),
    ),
    display_order: Type.Optional(Type.Integer({ minimum: 0 })),
    is_active: Type.Optional(Type.Boolean()),
  },
  { ...strict, $id: "InventoryLocationInput" },
);
export const InventoryLocationUpdateSchema = Type.Partial(
  InventoryLocationBodySchema,
  { $id: "InventoryLocationUpdateInput" },
);
export const InventoryPositionBodySchema = Type.Object(
  {
    product_id: uuid(),
    location_id: uuid(),
    initial_quantity: Type.Integer({ minimum: 0, maximum: 999999999 }),
    minimum_quantity: Type.Optional(
      Type.Integer({ minimum: 0, maximum: 999999999 }),
    ),
    ideal_quantity: Type.Optional(
      Type.Integer({ minimum: 0, maximum: 999999999 }),
    ),
    average_unit_cost: Type.Optional(nullable(Type.Number({ minimum: 0 }))),
    idempotency_key: uuid(),
  },
  { ...strict, $id: "InventoryPositionInput" },
);
export const InventoryPositionUpdateSchema = Type.Partial(
  Type.Object(
    {
      minimum_quantity: Type.Integer({ minimum: 0, maximum: 999999999 }),
      ideal_quantity: Type.Integer({ minimum: 0, maximum: 999999999 }),
      is_active: Type.Boolean(),
    },
    strict,
  ),
  { $id: "InventoryPositionUpdateInput" },
);
const InventoryDocumentLineBodySchema = Type.Object(
  {
    position_id: uuid(),
    quantity: Type.Integer({ minimum: 1, maximum: 999999999 }),
    unit_cost: Type.Optional(nullable(Type.Number({ minimum: 0 }))),
  },
  strict,
);
export const InventoryDocumentBodySchema = Type.Object(
  {
    kind: InventoryDocumentKindSchema,
    direction: Type.Optional(
      Type.Union([Type.Literal("in"), Type.Literal("out")]),
    ),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
    reference_code: optionalNullable(
      Type.String({ minLength: 1, maxLength: 120 }),
    ),
    occurred_at: dateTime(),
    idempotency_key: uuid(),
    lines: Type.Array(InventoryDocumentLineBodySchema, {
      minItems: 1,
      maxItems: 100,
    }),
  },
  { ...strict, $id: "InventoryDocumentInput" },
);
export const InventoryTransferBodySchema = Type.Object(
  {
    source_location_id: uuid(),
    destination_location_id: uuid(),
    product_id: uuid(),
    quantity: Type.Integer({ minimum: 1, maximum: 999999999 }),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
    reference_code: optionalNullable(
      Type.String({ minLength: 1, maxLength: 120 }),
    ),
    occurred_at: dateTime(),
    idempotency_key: uuid(),
  },
  { ...strict, $id: "InventoryTransferInput" },
);
export const InventoryCountBodySchema = Type.Object(
  {
    location_id: uuid(),
    product_ids: Type.Optional(Type.Array(uuid(), { uniqueItems: true })),
    notes: optionalNullable(Type.String({ minLength: 1, maxLength: 1000 })),
    idempotency_key: uuid(),
  },
  { ...strict, $id: "InventoryCountInput" },
);
export const InventoryCountItemsBodySchema = Type.Object(
  {
    items: Type.Array(
      Type.Object(
        {
          item_id: uuid(),
          counted_quantity: Type.Integer({ minimum: 0, maximum: 999999999 }),
        },
        strict,
      ),
      { minItems: 1, maxItems: 1000 },
    ),
  },
  { ...strict, $id: "InventoryCountItemsInput" },
);
export const ConsumptionCorrectionBodySchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("partial_adjustment"),
      Type.Literal("full_void"),
    ]),
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
    expected_version: Type.Integer({ minimum: 0 }),
    items: Type.Optional(
      Type.Array(Type.Ref("ConsumptionCorrectionItemInput"), {
        minItems: 1,
        maxItems: 100,
      }),
    ),
  },
  { ...strict, $id: "ConsumptionCorrectionCreateInput" },
);
export const ConsumptionCorrectionDecisionBodySchema = Type.Object(
  {
    decision: Type.Union([Type.Literal("approve"), Type.Literal("reject")]),
    reason: optionalNullable(Type.String({ minLength: 3, maxLength: 1000 })),
  },
  { ...strict, $id: "ConsumptionCorrectionDecisionInput" },
);
export const StayRefundBodySchema = Type.Object(
  {
    amount: Type.Number({ exclusiveMinimum: 0, maximum: 9999999999.99 }),
    payment_method: ConsumptionPaymentMethodSchema,
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
    idempotency_key: uuid(),
    expected_version: Type.Integer({ minimum: 0 }),
    correction_id: optionalNullable(uuid()),
    original_tender_id: optionalNullable(uuid()),
    reference_code: optionalNullable(
      Type.String({ minLength: 1, maxLength: 200 }),
    ),
    method_override_reason: optionalNullable(
      Type.String({ minLength: 3, maxLength: 1000 }),
    ),
  },
  { ...strict, $id: "StayRefundInput" },
);
export const PartnerRefundConfirmationBodySchema = Type.Object(
  {
    reference_code: optionalNullable(
      Type.String({ minLength: 1, maxLength: 200 }),
    ),
  },
  { ...strict, $id: "PartnerRefundConfirmationInput" },
);

const timestamps = {
  created_at: Type.Optional(Type.String()),
  updated_at: Type.Optional(Type.String()),
};
export const HotelSchema = Type.Object(
  {
    id: uuid(),
    name: Type.String(),
    legal_name: nullable(Type.String()),
    tax_id: nullable(Type.String()),
    slug: Type.String(),
    phone: nullable(Type.String()),
    address_line: nullable(Type.String()),
    address_number: nullable(Type.String()),
    address_complement: nullable(Type.String()),
    district: nullable(Type.String()),
    city: nullable(Type.String()),
    state: nullable(Type.String()),
    country: nullable(Type.String()),
    zip_code: nullable(Type.String()),
    timezone: nullable(Type.String()),
    currency: nullable(Type.String()),
    checkin_time_start: optionalNullable(Type.String()),
    checkin_time_limit: optionalNullable(Type.String()),
    checkout_time_start: optionalNullable(Type.String()),
    checkout_time_limit: optionalNullable(Type.String()),
    email: nullable(Type.String()),
    is_active: Type.Boolean(),
    ...timestamps,
  },
  { ...strict, $id: "Hotel" },
);
const UserRoleAssignmentSchema = Type.Object(
  {
    role_id: uuid(),
    role_name: Type.String(),
    role_type: RoleTypeSchema,
    hotel_id: nullable(uuid()),
    hotel_name: nullable(Type.String()),
    role_hotel_id: optionalNullable(uuid()),
    role_hotel_name: optionalNullable(Type.String()),
  },
  strict,
);
export const UserSchema = Type.Object(
  {
    id: uuid(),
    name: Type.String(),
    email: Type.String(),
    is_active: Type.Boolean(),
    last_login_at: optionalNullable(Type.String()),
    created_at: optionalNullable(Type.String()),
    role_assignments: Type.Array(UserRoleAssignmentSchema),
  },
  { ...strict, $id: "User" },
);
const RolePermissionSchema = Type.Object(
  { id: uuid(), name: Type.String(), type: PermissionTypeSchema },
  strict,
);
export const RoleSchema = Type.Object(
  {
    id: uuid(),
    name: Type.String(),
    role_type: RoleTypeSchema,
    hotel_id: nullable(uuid()),
    hotel_name: nullable(Type.String()),
    permissions: Type.Array(RolePermissionSchema),
  },
  { ...strict, $id: "Role" },
);
export const PermissionSchema = Type.Object(
  { id: uuid(), name: Type.String(), type: PermissionTypeSchema },
  { ...strict, $id: "Permission" },
);
export const RoomSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    room_number: Type.String(),
    room_type: Type.String(),
    max_occupancy: Type.Integer(),
    base_daily_rate: Type.Number(),
    status: RoomStatusSchema,
    notes: nullable(Type.String()),
    ...timestamps,
  },
  { ...strict, $id: "Room" },
);
export const CustomerSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    full_name: Type.String(),
    document_number: Type.String(),
    document_type: Type.String(),
    email: nullable(Type.String()),
    mobile_phone: nullable(Type.String()),
    phone: nullable(Type.String()),
    birth_date: date(),
    nationality: nullable(Type.String()),
    notes: nullable(Type.String()),
    ...timestamps,
  },
  { ...strict, $id: "Customer" },
);
export const CommercialPartnerSummarySchema = Type.Object(
  {
    id: uuid(),
    trade_name: Type.String(),
    is_active: Type.Boolean(),
    archived_at: nullable(dateTime()),
  },
  { ...strict, $id: "CommercialPartnerSummary" },
);
export const ProductProviderSchema = Type.Union(
  [
    Type.Object({ type: Type.Literal("hotel"), partner: Type.Null() }, strict),
    Type.Object(
      {
        type: Type.Literal("partner"),
        partner: Type.Object({ id: uuid(), trade_name: Type.String() }, strict),
      },
      strict,
    ),
  ],
  { $id: "ProductProvider" },
);
export const ProductSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    name: Type.String(),
    category: Type.Ref("ProductCategory"),
    description: nullable(Type.String()),
    internal_code: nullable(Type.String()),
    kind: ProductKindSchema,
    sales_unit: ProductSalesUnitSchema,
    unit_price: Type.Number(),
    status: ProductStatusSchema,
    archived_at: nullable(dateTime()),
    provider: Type.Ref("ProductProvider"),
    ...timestamps,
  },
  { ...strict, $id: "Product" },
);
export const ProductCategorySchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    name: Type.String(),
    display_order: Type.Integer(),
    is_active: Type.Boolean(),
    archived_at: nullable(dateTime()),
    ...timestamps,
  },
  { ...strict, $id: "ProductCategory" },
);
export const CatalogAuditEventSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    entity_type: Type.Union([
      Type.Literal("product"),
      Type.Literal("product_category"),
    ]),
    entity_id: uuid(),
    actor_id: nullable(uuid()),
    actor_name: nullable(Type.String()),
    action: Type.String(),
    changes: Type.Record(Type.String(), Type.Unknown()),
    created_at: dateTime(),
  },
  { ...strict, $id: "CatalogAuditEvent" },
);
export const CommercialPartnerContactSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    partner_id: uuid(),
    name: Type.String(),
    role: nullable(Type.String()),
    purpose: CommercialContactPurposeSchema,
    email: nullable(Type.String()),
    phone: nullable(Type.String()),
    is_primary: Type.Boolean(),
    is_active: Type.Boolean(),
    archived_at: nullable(dateTime()),
    ...timestamps,
  },
  { ...strict, $id: "CommercialPartnerContact" },
);
export const CommercialPartnerSchema = Type.Object(
  {
    ...CommercialPartnerSummarySchema.properties,
    hotel_id: uuid(),
    legal_name: Type.String(),
    tax_id: nullable(Type.String()),
    email: nullable(Type.String()),
    phone: nullable(Type.String()),
    notes: nullable(Type.String()),
    contacts: Type.Array(Type.Ref("CommercialPartnerContact")),
    ...timestamps,
  },
  { ...strict, $id: "CommercialPartner" },
);
const CommercialRevisionStatusSchema = Type.Union([
  Type.Literal("draft"),
  Type.Literal("activated"),
  Type.Literal("terminated"),
]);
const CommercialRevisionEffectiveStatusSchema = Type.Union([
  Type.Literal("draft"),
  Type.Literal("scheduled"),
  Type.Literal("current"),
  Type.Literal("expired"),
  Type.Literal("terminated"),
  Type.Literal("superseded"),
]);
export const CommercialAgreementRevisionSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    agreement_id: uuid(),
    version: Type.Integer(),
    starts_on: date(),
    ends_on: nullable(date()),
    status: CommercialRevisionStatusSchema,
    effective_status: CommercialRevisionEffectiveStatusSchema,
    commercial_model: CommercialModelSchema,
    fixed_rent: nullable(Type.Number()),
    rent_frequency: nullable(CommercialRentFrequencySchema),
    commission_percentage: nullable(Type.Number()),
    minimum_guarantee: nullable(Type.Number()),
    payment_recipient: CommercialPaymentRecipientSchema,
    currency: Type.String(),
    notes: nullable(Type.String()),
    point_ids: Type.Array(uuid()),
    activated_at: nullable(dateTime()),
    terminated_at: nullable(dateTime()),
    ...timestamps,
  },
  { ...strict, $id: "CommercialAgreementRevision" },
);
export const CommercialAgreementSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    partner: Type.Ref("CommercialPartnerSummary"),
    internal_number: Type.String(),
    archived_at: nullable(dateTime()),
    revisions: Type.Array(Type.Ref("CommercialAgreementRevision")),
    current_revision: nullable(Type.Ref("CommercialAgreementRevision")),
    ...timestamps,
  },
  { ...strict, $id: "CommercialAgreement" },
);
export const CommercialAgreementEligibilitySchema = Type.Object(
  {
    agreement_id: uuid(),
    internal_number: Type.String(),
    eligible: Type.Boolean(),
    reason: nullable(Type.String()),
    revision: nullable(
      Type.Object(
        {
          id: uuid(),
          version: Type.Integer(),
          starts_on: date(),
          ends_on: nullable(date()),
          commercial_model: CommercialModelSchema,
          fixed_rent: nullable(Type.Number()),
          rent_frequency: nullable(CommercialRentFrequencySchema),
          commission_percentage: nullable(Type.Number()),
          minimum_guarantee: nullable(Type.Number()),
          payment_recipient: CommercialPaymentRecipientSchema,
          currency: Type.String(),
        },
        strict,
      ),
    ),
  },
  { ...strict, $id: "CommercialAgreementEligibility" },
);
export const CommercialAuditEventSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    entity_type: Type.Union([
      Type.Literal("partner"),
      Type.Literal("partner_contact"),
      Type.Literal("agreement"),
      Type.Literal("agreement_revision"),
      Type.Literal("agreement_revision_point"),
    ]),
    entity_id: uuid(),
    actor_id: nullable(uuid()),
    actor_name: nullable(Type.String()),
    action: Type.String(),
    changes: Type.Record(Type.String(), Type.Unknown()),
    created_at: dateTime(),
  },
  { ...strict, $id: "CommercialAuditEvent" },
);
export const ConsumptionPointSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    name: Type.String(),
    internal_code: nullable(Type.String()),
    description: nullable(Type.String()),
    display_order: Type.Integer(),
    is_active: Type.Boolean(),
    default_policy: Type.Ref("ConsumptionBillingPolicy"),
    inherited_offers_count: Type.Integer(),
    offers_count: Type.Integer(),
    archived_at: nullable(dateTime()),
    default_inventory_location: Type.Optional(
      nullable(
        Type.Object(
          {
            id: uuid(),
            name: Type.String(),
            internal_code: nullable(Type.String()),
            is_active: Type.Boolean(),
            archived_at: nullable(dateTime()),
          },
          strict,
        ),
      ),
    ),
    ...timestamps,
  },
  { ...strict, $id: "ConsumptionPoint" },
);
const ConsumptionPointSummarySchema = Type.Object(
  {
    id: uuid(),
    name: Type.String(),
    internal_code: nullable(Type.String()),
    is_active: Type.Boolean(),
    archived_at: nullable(dateTime()),
  },
  strict,
);
const ConsumptionUnavailableReasonSchema = Type.Union([
  Type.Literal("point_inactive"),
  Type.Literal("point_archived"),
  Type.Literal("offer_inactive"),
  Type.Literal("offer_archived"),
  Type.Literal("product_inactive"),
  Type.Literal("product_archived"),
  Type.Literal("category_inactive"),
  Type.Literal("category_archived"),
  Type.Literal("partner_inactive"),
  Type.Literal("partner_archived"),
  Type.Literal("agreement_missing"),
  Type.Literal("agreement_draft"),
  Type.Literal("agreement_scheduled"),
  Type.Literal("agreement_expired"),
  Type.Literal("agreement_terminated"),
  Type.Literal("agreement_outside_point"),
  Type.Literal("billing_mode_incompatible"),
  Type.Literal("agreement_revision_missing"),
  Type.Literal("inventory_source_missing"),
  Type.Literal("inventory_position_inactive"),
]);
export const ConsumptionOfferSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    point: ConsumptionPointSummarySchema,
    product: Type.Ref("Product"),
    display_order: Type.Integer(),
    is_active: Type.Boolean(),
    policy: Type.Ref("ConsumptionOfferPolicyInput"),
    resolved_policy: Type.Intersect([
      Type.Ref("ConsumptionBillingPolicy"),
      Type.Object({ source: ConsumptionPolicySourceSchema }, strict),
    ]),
    effective_available: Type.Boolean(),
    unavailable_reasons: Type.Array(ConsumptionUnavailableReasonSchema),
    commercial_agreement: nullable(
      Type.Object({ id: uuid(), internal_number: Type.String() }, strict),
    ),
    commercial_revision: nullable(Type.Ref("CommercialAgreementRevision")),
    archived_at: nullable(dateTime()),
    inventory_location: Type.Optional(
      nullable(
        Type.Object(
          {
            id: uuid(),
            name: Type.String(),
            internal_code: nullable(Type.String()),
            is_active: Type.Boolean(),
            archived_at: nullable(dateTime()),
          },
          strict,
        ),
      ),
    ),
    inventory_source: Type.Optional(
      Type.Union([
        Type.Literal("unmanaged"),
        Type.Literal("point"),
        Type.Literal("offer"),
        Type.Literal("missing"),
      ]),
    ),
    ...timestamps,
  },
  { ...strict, $id: "ConsumptionOffer" },
);
export const ConsumptionConfigurationAuditEventSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    entity_type: Type.Union([
      Type.Literal("consumption_point"),
      Type.Literal("consumption_offer"),
    ]),
    entity_id: uuid(),
    actor_id: nullable(uuid()),
    actor_name: nullable(Type.String()),
    action: Type.String(),
    changes: Type.Record(Type.String(), Type.Unknown()),
    created_at: dateTime(),
  },
  { ...strict, $id: "ConsumptionConfigurationAuditEvent" },
);

export const InventorySettingsSchema = Type.Object(
  {
    hotel_id: uuid(),
    negative_stock_policy: InventoryNegativeStockPolicySchema,
    updated_at: dateTime(),
  },
  { ...strict, $id: "InventorySettings" },
);
export const InventoryLocationSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    name: Type.String(),
    internal_code: nullable(Type.String()),
    description: nullable(Type.String()),
    display_order: Type.Integer(),
    is_active: Type.Boolean(),
    archived_at: nullable(dateTime()),
    position_count: Type.Integer({ minimum: 0 }),
    total_quantity: Type.Number(),
    created_at: dateTime(),
    updated_at: dateTime(),
  },
  { ...strict, $id: "InventoryLocation" },
);
const InventoryLocationSummarySchema = Type.Object(
  {
    id: uuid(),
    name: Type.String(),
    internal_code: nullable(Type.String()),
    is_active: Type.Boolean(),
    archived_at: nullable(dateTime()),
  },
  strict,
);
export const InventoryPositionSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    product: Type.Object(
      {
        id: uuid(),
        name: Type.String(),
        internal_code: nullable(Type.String()),
        kind: ProductKindSchema,
        sales_unit: ProductSalesUnitSchema,
        provider: ProductProviderSchema,
      },
      strict,
    ),
    location: InventoryLocationSummarySchema,
    quantity: Type.Number(),
    version: Type.Integer(),
    minimum_quantity: Type.Number(),
    ideal_quantity: Type.Number(),
    suggested_replenishment: Type.Number(),
    average_unit_cost: Type.Optional(nullable(Type.Number())),
    inventory_value: Type.Optional(nullable(Type.Number())),
    status: Type.Union([
      Type.Literal("available"),
      Type.Literal("low"),
      Type.Literal("negative"),
      Type.Literal("unvalued"),
    ]),
    is_active: Type.Boolean(),
    archived_at: nullable(dateTime()),
    updated_at: dateTime(),
  },
  { ...strict, $id: "InventoryPosition" },
);
export const InventoryMovementSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    position_id: uuid(),
    product_id: uuid(),
    product_name: Type.String(),
    location_id: uuid(),
    location_name: Type.String(),
    kind: InventoryMovementKindSchema,
    quantity_delta: Type.Number(),
    quantity_before: Type.Number(),
    quantity_after: Type.Number(),
    average_unit_cost: Type.Optional(nullable(Type.Number())),
    total_cost: Type.Optional(nullable(Type.Number())),
    reason: nullable(Type.String()),
    reference_code: nullable(Type.String()),
    occurred_at: dateTime(),
    posted_at: dateTime(),
    actor_id: nullable(uuid()),
    actor_name: nullable(Type.String()),
    consumption_order_id: nullable(uuid()),
    consumption_order_item_id: nullable(uuid()),
    consumption_correction_id: nullable(uuid()),
    document_id: nullable(uuid()),
    count_session_id: nullable(uuid()),
  },
  { ...strict, $id: "InventoryMovement" },
);
export const InventoryAuditEventSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    entity_type: Type.Union([
      Type.Literal("settings"),
      Type.Literal("location"),
      Type.Literal("position"),
      Type.Literal("document"),
      Type.Literal("count"),
    ]),
    entity_id: uuid(),
    action: Type.String(),
    actor_id: nullable(uuid()),
    actor_name: nullable(Type.String()),
    changes: Type.Record(Type.String(), Type.Unknown()),
    created_at: dateTime(),
  },
  { ...strict, $id: "InventoryAuditEvent" },
);
export const InventoryCountSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    location: InventoryLocationSummarySchema,
    status: Type.Union([
      Type.Literal("draft"),
      Type.Literal("completed"),
      Type.Literal("canceled"),
    ]),
    notes: nullable(Type.String()),
    created_by: uuid(),
    created_at: dateTime(),
    completed_by: nullable(uuid()),
    completed_at: nullable(dateTime()),
    canceled_by: nullable(uuid()),
    canceled_at: nullable(dateTime()),
    items: Type.Array(
      Type.Object(
        {
          id: uuid(),
          position_id: uuid(),
          product_id: uuid(),
          product_name: Type.String(),
          expected_quantity: Type.Number(),
          expected_version: Type.Integer(),
          counted_quantity: nullable(Type.Number()),
        },
        strict,
      ),
    ),
  },
  { ...strict, $id: "InventoryCount" },
);

export const ConsumptionEligibleStaySchema = Type.Object(
  {
    id: uuid(),
    reservation_id: uuid(),
    reservation_code: Type.String(),
    room_number: Type.String(),
    room_type: Type.String(),
    primary_guest_name: Type.String(),
    checkin_date_actual: dateTime(),
  },
  { ...strict, $id: "ConsumptionEligibleStay" },
);
export const ConsumptionContextGuestSchema = Type.Object(
  { id: uuid(), full_name: Type.String() },
  { ...strict, $id: "ConsumptionContextGuest" },
);
export const ConsumptionContextOfferSchema = Type.Object(
  {
    id: uuid(),
    point_id: uuid(),
    point_name: Type.String(),
    product_id: uuid(),
    product_name: Type.String(),
    product_code: nullable(Type.String()),
    product_kind: ProductKindSchema,
    sales_unit: ProductSalesUnitSchema,
    category_id: uuid(),
    category_name: Type.String(),
    unit_price: Type.Number(),
    currency: Type.String(),
    provider_type: ProductProviderSchema,
    partner_id: nullable(uuid()),
    partner_name: nullable(Type.String()),
    agreement_id: nullable(uuid()),
    agreement_number: nullable(Type.String()),
    revision: nullable(Type.Ref("CommercialAgreementRevision")),
    allowed_modes: Type.Array(ConsumptionBillingModeSchema),
    default_mode: nullable(ConsumptionBillingModeSchema),
    policy_source: ConsumptionPolicySourceSchema,
    available: Type.Boolean(),
    reasons: Type.Array(ConsumptionUnavailableReasonSchema),
    version_token: Type.String(),
    inventory: Type.Optional(
      Type.Object(
        {
          controlled: Type.Boolean(),
          source: Type.Union([
            Type.Literal("unmanaged"),
            Type.Literal("point"),
            Type.Literal("offer"),
            Type.Literal("missing"),
          ]),
          location_id: Type.Optional(uuid()),
          location_name: Type.Optional(Type.String()),
          position_id: Type.Optional(uuid()),
          quantity: Type.Optional(Type.Number()),
          version: Type.Optional(Type.Integer()),
          active: Type.Optional(Type.Boolean()),
          status: Type.Optional(Type.String()),
        },
        strict,
      ),
    ),
  },
  { ...strict, $id: "ConsumptionContextOffer" },
);
export const ConsumptionOperationalContextSchema = Type.Object(
  {
    stay: Type.Object(
      {
        id: uuid(),
        reservation_id: uuid(),
        reservation_code: Type.String(),
        room_id: uuid(),
        room_number: Type.String(),
        room_type: Type.String(),
        primary_guest_name: Type.String(),
        checkin_date_actual: dateTime(),
        checkout_date_expected: dateTime(),
        stay_status: Type.Literal("checked_in"),
      },
      strict,
    ),
    guests: Type.Array(Type.Ref("ConsumptionContextGuest")),
    offers: Type.Array(Type.Ref("ConsumptionContextOffer")),
    occurred_at: dateTime(),
  },
  { ...strict, $id: "ConsumptionOperationalContext" },
);

const ConsumptionOrderDispositionSchema = Type.Union([
  Type.Literal("charged"),
  Type.Literal("courtesy"),
  Type.Literal("legacy_unclassified"),
]);
export const ConsumptionOrderItemSchema = Type.Object(
  {
    id: uuid(),
    offer_id: nullable(uuid()),
    product_id: uuid(),
    quantity: Type.Number(),
    charged_unit_price: Type.Number(),
    gross_amount: Type.Number(),
    discount_amount: Type.Number(),
    net_amount: Type.Number(),
    effective_quantity: Type.Optional(Type.Number()),
    effective_discount: Type.Optional(Type.Number()),
    effective_net_amount: Type.Optional(Type.Number()),
    product_name: Type.String(),
    product_code: nullable(Type.String()),
    category_name: Type.String(),
    product_kind: ProductKindSchema,
    sales_unit: ProductSalesUnitSchema,
    provider_type: ProductProviderSchema,
    partner_id: nullable(uuid()),
    partner_name: nullable(Type.String()),
    agreement_id: nullable(uuid()),
    agreement_number: nullable(Type.String()),
    commercial_revision_id: nullable(uuid()),
    commercial_revision_version: nullable(Type.Integer()),
    commercial_terms: Type.Optional(
      nullable(Type.Record(Type.String(), Type.Unknown())),
    ),
    billing_policy: Type.Record(Type.String(), Type.Unknown()),
    version_token: Type.String(),
    notes: nullable(Type.String()),
    inventory_controlled: Type.Optional(Type.Boolean()),
    inventory_location_id: Type.Optional(nullable(uuid())),
    inventory_location_name: Type.Optional(nullable(Type.String())),
    inventory_position_version: Type.Optional(nullable(Type.Integer())),
  },
  { ...strict, $id: "ConsumptionOrderItem" },
);
export const ConsumptionOrderEventSchema = Type.Object(
  {
    id: uuid(),
    action: Type.String(),
    actor_id: nullable(uuid()),
    actor_name: nullable(Type.String()),
    details: Type.Record(Type.String(), Type.Unknown()),
    created_at: dateTime(),
  },
  { ...strict, $id: "ConsumptionOrderEvent" },
);
export const ConsumptionOrderSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    stay_id: nullable(uuid()),
    reservation_id: nullable(uuid()),
    point_id: nullable(uuid()),
    guest_customer_id: nullable(uuid()),
    disposition: ConsumptionOrderDispositionSchema,
    billing_mode: nullable(ConsumptionBillingModeSchema),
    payment_method: nullable(ConsumptionPaymentMethodSchema),
    payment_reference: nullable(Type.String()),
    partner_receipt_confirmed: Type.Boolean(),
    currency: Type.String(),
    gross_amount: Type.Number(),
    discount_amount: Type.Number(),
    net_amount: Type.Number(),
    effective_gross_amount: Type.Optional(Type.Number()),
    effective_discount_amount: Type.Optional(Type.Number()),
    effective_net_amount: Type.Optional(Type.Number()),
    effective_status: Type.Optional(
      Type.Union([
        Type.Literal("active"),
        Type.Literal("correction_pending"),
        Type.Literal("refund_pending"),
        Type.Literal("partner_refund_pending"),
        Type.Literal("adjusted"),
        Type.Literal("voided"),
        Type.Literal("legacy"),
      ]),
    ),
    reservation_code: nullable(Type.String()),
    room_number: nullable(Type.String()),
    guest_name: nullable(Type.String()),
    point_name: nullable(Type.String()),
    notes: nullable(Type.String()),
    courtesy_reason: nullable(Type.String()),
    occurred_at: dateTime(),
    posted_at: dateTime(),
    posted_by: nullable(uuid()),
    operator_name: nullable(Type.String()),
    is_legacy: Type.Boolean(),
    account_version: Type.Optional(Type.Integer({ minimum: 0 })),
    items: Type.Array(Type.Ref("ConsumptionOrderItem")),
    events: Type.Optional(Type.Array(Type.Ref("ConsumptionOrderEvent"))),
    folio_entry_ids: Type.Optional(Type.Array(uuid())),
    financial_transaction_ids: Type.Optional(Type.Array(uuid())),
  },
  { ...strict, $id: "ConsumptionOrder" },
);
export const ConsumptionOrderHistorySchema = Type.Object(
  {
    items: Type.Array(Type.Ref("ConsumptionOrder")),
    next_cursor: nullable(dateTime()),
  },
  { ...strict, $id: "ConsumptionOrderHistory" },
);

const MonthStartDateSchema = Type.String({
  format: "date",
  pattern: "^\\d{4}-\\d{2}-01$",
});

export const ConsumptionManagementSettingsBodySchema = Type.Object(
  {
    settlement_tracking_starts_on: MonthStartDateSchema,
    payment_due_days: Type.Integer({ minimum: 0, maximum: 90 }),
    agreement_expiry_alert_days: Type.Integer({ minimum: 1, maximum: 365 }),
    guest_balance_alert_days: Type.Integer({ minimum: 0, maximum: 30 }),
  },
  { ...strict, $id: "ConsumptionManagementSettingsInput" },
);
export const ConsumptionManagementSettingsSchema = Type.Object(
  {
    hotel_id: uuid(),
    ...ConsumptionManagementSettingsBodySchema.properties,
    last_changed_by: nullable(uuid()),
    created_at: dateTime(),
    updated_at: dateTime(),
  },
  { ...strict, $id: "ConsumptionManagementSettings" },
);
export const ConsumptionAnalyticsDimensionSchema = Type.Union(
  [
    Type.Literal("day"),
    Type.Literal("point"),
    Type.Literal("category"),
    Type.Literal("product"),
    Type.Literal("stay"),
    Type.Literal("billing_mode"),
    Type.Literal("payment_method"),
    Type.Literal("provider"),
    Type.Literal("partner"),
    Type.Literal("operator"),
  ],
  { $id: "ConsumptionAnalyticsDimension" },
);
export const ConsumptionAnalyticsSummarySchema = Type.Object(
  {
    gross_sales: Type.Number(),
    discount_total: Type.Number(),
    courtesy_total: Type.Number(),
    reversal_total: Type.Number(),
    operational_net: Type.Number(),
    hotel_collected: Type.Number(),
    partner_direct: Type.Number(),
    order_count: Type.Integer(),
    legacy_count: Type.Integer(),
  },
  { ...strict, $id: "ConsumptionAnalyticsSummary" },
);
export const ConsumptionAnalyticsPointSchema = Type.Object(
  {
    date: date(),
    gross_sales: Type.Number(),
    operational_net: Type.Number(),
    order_count: Type.Integer(),
  },
  { ...strict, $id: "ConsumptionAnalyticsPoint" },
);
export const ConsumptionAnalyticsRowSchema = Type.Object(
  {
    key: Type.String(),
    label: Type.String(),
    gross_sales: Type.Number(),
    operational_net: Type.Number(),
    order_count: Type.Integer(),
  },
  { ...strict, $id: "ConsumptionAnalyticsRow" },
);
export const ConsumptionAnalyticsSchema = Type.Object(
  {
    summary: ConsumptionAnalyticsSummarySchema,
    series: Type.Array(ConsumptionAnalyticsPointSchema),
    rows: Type.Array(ConsumptionAnalyticsRowSchema),
    total: Type.Integer(),
    next_cursor: nullable(Type.String()),
  },
  { ...strict, $id: "ConsumptionAnalytics" },
);
const ManagementAlertKindSchema = Type.Union([
  Type.Literal("guest_balance"),
  Type.Literal("critical_stock"),
  Type.Literal("agreement_expiry"),
  Type.Literal("pending_settlement"),
]);
export const ManagementAlertSchema = Type.Object(
  {
    id: Type.String(),
    kind: ManagementAlertKindSchema,
    severity: Type.Union([Type.Literal("warning"), Type.Literal("critical")]),
    title: Type.String(),
    description: Type.String(),
    href: Type.String(),
    entity_id: uuid(),
    due_on: Type.Optional(nullable(date())),
    amount: Type.Optional(Type.Number()),
    quantity: Type.Optional(Type.Number()),
    guest_name: Type.Optional(nullable(Type.String())),
  },
  { ...strict, $id: "ManagementAlert" },
);
const ManagementAlertInlineSchema = Type.Omit(ManagementAlertSchema, []);
export const ManagementAlertsSchema = Type.Object(
  {
    guest_balances: Type.Array(ManagementAlertInlineSchema),
    critical_stock: Type.Array(ManagementAlertInlineSchema),
    expiring_agreements: Type.Array(ManagementAlertInlineSchema),
    pending_settlements: Type.Array(ManagementAlertInlineSchema),
  },
  { ...strict, $id: "ManagementAlerts" },
);
const PartnerSettlementStatusSchema = Type.Union([
  Type.Literal("draft"),
  Type.Literal("in_review"),
  Type.Literal("approved"),
  Type.Literal("settled"),
]);
const PartnerSettlementDirectionSchema = Type.Union([
  Type.Literal("hotel_to_partner"),
  Type.Literal("partner_to_hotel"),
  Type.Literal("balanced"),
]);
const PartnerSettlementSourceKindSchema = Type.Union([
  Type.Literal("regular"),
  Type.Literal("late_correction"),
]);
export const PartnerSettlementComponentSchema = Type.Object(
  {
    id: uuid(),
    source_kind: PartnerSettlementSourceKindSchema,
    agreement_id: uuid(),
    revision_id: uuid(),
    origin_component_id: nullable(uuid()),
    agreement_number: Type.String(),
    revision_version: Type.Integer(),
    segment_start: date(),
    segment_end: date(),
    commercial_model: CommercialModelSchema,
    fixed_rent: nullable(Type.Number()),
    rent_frequency: nullable(CommercialRentFrequencySchema),
    commission_percentage: nullable(Type.Number()),
    minimum_guarantee: nullable(Type.Number()),
    payment_recipient: CommercialPaymentRecipientSchema,
    gross_sales: Type.Number(),
    discount_total: Type.Number(),
    courtesy_total: Type.Number(),
    reversal_total: Type.Number(),
    operational_net: Type.Number(),
    hotel_collected: Type.Number(),
    partner_direct: Type.Number(),
    prorated_rent: Type.Number(),
    commission_amount: Type.Number(),
    prorated_minimum_guarantee: Type.Number(),
    minimum_guarantee_topup: Type.Number(),
    contribution_amount: Type.Number(),
    net_settlement_amount: Type.Number(),
    calculation_memory: Type.Record(Type.String(), Type.Unknown()),
  },
  { ...strict, $id: "PartnerSettlementComponent" },
);
export const PartnerSettlementSourceSchema = Type.Object(
  {
    id: uuid(),
    source_kind: PartnerSettlementSourceKindSchema,
    order_id: uuid(),
    order_item_id: uuid(),
    correction_id: nullable(uuid()),
    correction_item_id: nullable(uuid()),
    original_settlement_id: nullable(uuid()),
    occurred_at: dateTime(),
    completed_at: nullable(dateTime()),
    point_id: nullable(uuid()),
    point_name: nullable(Type.String()),
    product_id: uuid(),
    product_name: Type.String(),
    category_id: nullable(uuid()),
    category_name: Type.String(),
    stay_id: nullable(uuid()),
    reservation_code: nullable(Type.String()),
    room_number: nullable(Type.String()),
    billing_mode: nullable(ConsumptionBillingModeSchema),
    payment_method: nullable(ConsumptionPaymentMethodSchema),
    disposition: ConsumptionOrderDispositionSchema,
    provider_type: ProductProviderSchema,
    gross_amount: Type.Number(),
    discount_amount: Type.Number(),
    reversal_amount: Type.Number(),
    operational_net: Type.Number(),
    hotel_collected: Type.Number(),
    partner_direct: Type.Number(),
    source_snapshot: Type.Record(Type.String(), Type.Unknown()),
  },
  { ...strict, $id: "PartnerSettlementSource" },
);
export const PartnerSettlementPaymentSchema = Type.Object(
  {
    id: uuid(),
    financial_transaction_id: uuid(),
    amount: Type.Number(),
    direction: PartnerSettlementDirectionSchema,
    payment_method: ConsumptionPaymentMethodSchema,
    paid_at: dateTime(),
    reference_code: nullable(Type.String()),
    notes: nullable(Type.String()),
    created_by: uuid(),
    created_at: dateTime(),
    reversal_of_id: nullable(uuid()),
  },
  { ...strict, $id: "PartnerSettlementPayment" },
);
export const PartnerSettlementEventSchema = Type.Object(
  {
    id: uuid(),
    action: Type.String(),
    actor_id: nullable(uuid()),
    actor_name: nullable(Type.String()),
    details: Type.Record(Type.String(), Type.Unknown()),
    created_at: dateTime(),
  },
  { ...strict, $id: "PartnerSettlementEvent" },
);
export const PartnerSettlementSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    partner: Type.Ref("CommercialPartnerSummary"),
    period_start: date(),
    period_end: date(),
    currency: Type.String(),
    status: PartnerSettlementStatusSchema,
    direction: PartnerSettlementDirectionSchema,
    version: Type.Integer(),
    gross_sales: Type.Number(),
    discount_total: Type.Number(),
    courtesy_total: Type.Number(),
    reversal_total: Type.Number(),
    operational_net: Type.Number(),
    hotel_collected: Type.Number(),
    partner_direct: Type.Number(),
    rent_total: Type.Number(),
    commission_total: Type.Number(),
    minimum_guarantee_topup: Type.Number(),
    contribution_total: Type.Number(),
    net_settlement: Type.Number(),
    due_on: date(),
    prepared_by: nullable(uuid()),
    prepared_at: nullable(dateTime()),
    submitted_by: nullable(uuid()),
    submitted_at: nullable(dateTime()),
    approved_by: nullable(uuid()),
    approved_at: nullable(dateTime()),
    settled_by: nullable(uuid()),
    settled_at: nullable(dateTime()),
    statement_snapshot: nullable(Type.Record(Type.String(), Type.Unknown())),
    components: Type.Array(PartnerSettlementComponentSchema),
    sources: Type.Array(PartnerSettlementSourceSchema),
    payments: Type.Array(PartnerSettlementPaymentSchema),
    events: Type.Array(PartnerSettlementEventSchema),
    created_at: dateTime(),
    updated_at: dateTime(),
  },
  { ...strict, $id: "PartnerSettlement" },
);
export const PartnerSettlementCandidateSchema = Type.Object(
  {
    partner: Type.Ref("CommercialPartnerSummary"),
    period_start: date(),
    period_end: date(),
    settlement_id: nullable(uuid()),
    status: Type.Union([
      PartnerSettlementStatusSchema,
      Type.Literal("missing"),
    ]),
  },
  { ...strict, $id: "PartnerSettlementCandidate" },
);
export const PartnerSettlementCreateBodySchema = Type.Object(
  { partner_id: uuid(), period_start: MonthStartDateSchema },
  { ...strict, $id: "PartnerSettlementCreateInput" },
);
export const PartnerSettlementVersionBodySchema = Type.Object(
  { expected_version: Type.Integer({ minimum: 1 }) },
  { ...strict, $id: "PartnerSettlementVersionInput" },
);
export const PartnerSettlementDecisionBodySchema = Type.Object(
  {
    expected_version: Type.Integer({ minimum: 1 }),
    decision: Type.Union([Type.Literal("approve"), Type.Literal("reject")]),
    reason: optionalNullable(Type.String({ minLength: 3, maxLength: 1000 })),
  },
  { ...strict, $id: "PartnerSettlementDecisionInput" },
);
export const PartnerSettlementPaymentBodySchema = Type.Object(
  {
    expected_version: Type.Integer({ minimum: 1 }),
    amount: Type.Number({ exclusiveMinimum: 0 }),
    payment_method: ConsumptionPaymentMethodSchema,
    paid_at: dateTime(),
    reference_code: optionalNullable(
      Type.String({ minLength: 1, maxLength: 200 }),
    ),
    notes: optionalNullable(Type.String({ minLength: 3, maxLength: 1000 })),
    idempotency_key: uuid(),
  },
  { ...strict, $id: "PartnerSettlementPaymentInput" },
);
export const PartnerSettlementPaymentReversalBodySchema = Type.Object(
  {
    reason: Type.String({ minLength: 3, maxLength: 1000 }),
    reversed_at: dateTime(),
    idempotency_key: uuid(),
  },
  { ...strict, $id: "PartnerSettlementPaymentReversalInput" },
);
export const SeasonSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    name: Type.String(),
    start_date: date(),
    end_date: date(),
    is_active: Type.Boolean(),
    ...timestamps,
  },
  { ...strict, $id: "Season" },
);
export const SeasonRoomRateSchema = Type.Object(
  {
    id: uuid(),
    season_id: uuid(),
    hotel_id: uuid(),
    room_type: Type.String(),
    daily_rate: Type.Number(),
    ...timestamps,
  },
  { ...strict, $id: "SeasonRoomRate" },
);
export const FinancialTransactionSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    type: TransactionTypeSchema,
    category: Type.String(),
    amount: Type.Number(),
    currency: Type.String(),
    description: nullable(Type.String()),
    status: TransactionStatusSchema,
    stay_id: optionalNullable(uuid()),
    reservation_id: optionalNullable(uuid()),
    payment_method: optionalNullable(Type.String()),
    paid_at: optionalNullable(Type.String()),
    due_date: optionalNullable(date()),
    counterparty: optionalNullable(Type.String()),
    cost_center: optionalNullable(Type.String()),
    reference_code: optionalNullable(Type.String()),
    created_by: optionalNullable(uuid()),
    maintenance_cost_item_id: optionalNullable(uuid()),
    maintenance_recovery_id: optionalNullable(uuid()),
    ...timestamps,
  },
  { ...strict, $id: "FinancialTransaction" },
);

const AuthRoleAssignmentSchema = Type.Object(
  {
    roleId: Type.String(),
    roleName: Type.String(),
    roleType: RoleTypeSchema,
    hotelId: nullable(Type.String()),
    hotelName: nullable(Type.String()),
    permissions: Type.Optional(Type.Array(Type.String())),
  },
  strict,
);
export const AuthUserSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    email: Type.String(),
    tenantId: nullable(Type.String()),
    roles: Type.Array(Type.String()),
    permissions: Type.Array(Type.String()),
    roleAssignments: Type.Array(AuthRoleAssignmentSchema),
  },
  { ...strict, $id: "AuthUser" },
);
export const LoginResponseSchema = Type.Object(
  { token: Type.String(), expiresIn: Type.Integer(), user: AuthUserSchema },
  { ...strict, $id: "LoginResponse" },
);
export const MeResponseSchema = Type.Object(
  { user: AuthUserSchema },
  { ...strict, $id: "MeResponse" },
);
const HotelOptionSchema = Type.Object(
  { id: uuid(), name: Type.String() },
  strict,
);
const RoleOptionSchema = Type.Object(
  {
    id: uuid(),
    name: Type.String(),
    role_type: RoleTypeSchema,
    hotel_id: nullable(uuid()),
    hotel_name: nullable(Type.String()),
  },
  strict,
);
export const UserReferenceDataSchema = Type.Object(
  {
    hotels: Type.Array(HotelOptionSchema),
    roles: Type.Array(RoleOptionSchema),
  },
  { ...strict, $id: "UserReferenceData" },
);
export const RoleReferenceDataSchema = Type.Object(
  {
    hotels: Type.Array(HotelOptionSchema),
    permissions: Type.Array(PermissionSchema),
  },
  { ...strict, $id: "RoleReferenceData" },
);

const ReservationStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("confirmed"),
  Type.Literal("checked_in"),
  Type.Literal("checked_out"),
  Type.Literal("canceled"),
  Type.Literal("no_show"),
]);
const PaymentStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("partial"),
  Type.Literal("paid"),
]);
const MaintenancePrioritySchema = Type.Union([
  Type.Literal("low"),
  Type.Literal("normal"),
  Type.Literal("high"),
  Type.Literal("critical"),
]);
const MaintenanceOccurrenceKindSchema = Type.Union([
  Type.Literal("damage"),
  Type.Literal("defect"),
  Type.Literal("wear"),
  Type.Literal("safety_risk"),
  Type.Literal("special_cleaning"),
  Type.Literal("preventive"),
  Type.Literal("other"),
]);
const MaintenanceOccurrenceStatusSchema = Type.Union([
  Type.Literal("reported"),
  Type.Literal("triaged"),
  Type.Literal("in_progress"),
  Type.Literal("awaiting_inspection"),
  Type.Literal("awaiting_liability"),
  Type.Literal("resolved"),
  Type.Literal("canceled"),
]);
const MaintenanceWorkOrderStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("assigned"),
  Type.Literal("in_progress"),
  Type.Literal("paused"),
  Type.Literal("waiting"),
  Type.Literal("awaiting_inspection"),
  Type.Literal("completed"),
  Type.Literal("canceled"),
]);
const MaintenanceLiabilityStatusSchema = Type.Union([
  Type.Literal("not_applicable"),
  Type.Literal("not_assessed"),
  Type.Literal("suspected"),
  Type.Literal("confirmed"),
  Type.Literal("dismissed"),
]);
const MaintenanceResponsiblePartySchema = Type.Union([
  Type.Literal("guest"),
  Type.Literal("hotel"),
  Type.Literal("supplier"),
  Type.Literal("normal_wear"),
]);
export const MaintenanceCategorySchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    name: Type.String(),
    description: nullable(Type.String()),
    display_order: Type.Integer(),
    is_active: Type.Boolean(),
    asset_tag: Type.Optional(nullable(Type.String())),
    manufacturer: Type.Optional(nullable(Type.String())),
    model: Type.Optional(nullable(Type.String())),
    serial_number: Type.Optional(nullable(Type.String())),
    installed_on: Type.Optional(nullable(date())),
    warranty_ends_on: Type.Optional(nullable(date())),
    supplier_id: Type.Optional(nullable(uuid())),
    contract_id: Type.Optional(nullable(uuid())),
    lifecycle_status: Type.Optional(
      nullable(
        Type.Union([
          Type.Literal("active"),
          Type.Literal("out_of_service"),
          Type.Literal("retired"),
        ]),
      ),
    ),
    created_at: dateTime(),
    updated_at: dateTime(),
  },
  { ...strict, $id: "MaintenanceCategory" },
);
export const MaintenanceLocationSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    parent_location_id: nullable(uuid()),
    parent_name: Type.Optional(nullable(Type.String())),
    kind: Type.Union([Type.Literal("area"), Type.Literal("equipment")]),
    name: Type.String(),
    description: nullable(Type.String()),
    display_order: Type.Integer(),
    is_active: Type.Boolean(),
    created_at: dateTime(),
    updated_at: dateTime(),
  },
  { ...strict, $id: "MaintenanceLocation" },
);
export const MaintenanceOccurrenceSummarySchema = Type.Object(
  {
    id: uuid(),
    occurrence_number: Type.Integer(),
    code: Type.String(),
    kind: MaintenanceOccurrenceKindSchema,
    priority: MaintenancePrioritySchema,
    status: MaintenanceOccurrenceStatusSchema,
    description: Type.String(),
    category_id: uuid(),
    category_name: Type.String(),
    room_id: nullable(uuid()),
    room_number: nullable(Type.String()),
    location_id: nullable(uuid()),
    location_name: nullable(Type.String()),
    stay_id: nullable(uuid()),
    reported_by: uuid(),
    reporter_name: Type.String(),
    blocking_recommended: Type.Boolean(),
    liability_status: MaintenanceLiabilityStatusSchema,
    active_block: Type.Boolean(),
    open_work_orders: Type.Integer(),
    preventive_plan_id: Type.Optional(nullable(uuid())),
    sla_response_due_at: Type.Optional(nullable(dateTime())),
    sla_resolution_due_at: Type.Optional(nullable(dateTime())),
    operational_resolved_at: Type.Optional(nullable(dateTime())),
    created_at: dateTime(),
    updated_at: dateTime(),
  },
  { ...strict, $id: "MaintenanceOccurrenceSummary" },
);
export const MaintenanceWorkOrderSchema = Type.Object(
  {
    id: uuid(),
    occurrence_id: uuid(),
    title: Type.String(),
    instructions: Type.String(),
    priority: MaintenancePrioritySchema,
    status: MaintenanceWorkOrderStatusSchema,
    assigned_to: nullable(uuid()),
    assignee_name: nullable(Type.String()),
    due_at: nullable(dateTime()),
    waiting_reason: nullable(
      Type.Union([
        Type.Literal("parts"),
        Type.Literal("vendor"),
        Type.Literal("authorization"),
        Type.Literal("access"),
        Type.Literal("other"),
      ]),
    ),
    waiting_notes: nullable(Type.String()),
    requires_inspection: Type.Boolean(),
    diagnosis: nullable(Type.String()),
    resolution_notes: nullable(Type.String()),
    started_at: nullable(dateTime()),
    completed_at: nullable(dateTime()),
    created_at: dateTime(),
    updated_at: dateTime(),
  },
  { ...strict, $id: "MaintenanceWorkOrder" },
);
const MaintenanceInspectionSchema = Type.Object(
  {
    id: uuid(),
    work_order_id: uuid(),
    inspector_id: uuid(),
    inspector_name: Type.String(),
    result: Type.Union([Type.Literal("approved"), Type.Literal("rejected")]),
    notes: Type.String(),
    created_at: dateTime(),
  },
  strict,
);
const MaintenanceEventSchema = Type.Object(
  {
    id: uuid(),
    occurrence_id: uuid(),
    work_order_id: nullable(uuid()),
    actor_id: uuid(),
    actor_name: Type.String(),
    event_type: Type.String(),
    message: nullable(Type.String()),
    metadata: Type.Record(Type.String(), Type.Unknown()),
    created_at: dateTime(),
  },
  strict,
);
const MaintenanceAttachmentSchema = Type.Object(
  {
    id: uuid(),
    occurrence_id: uuid(),
    work_order_id: nullable(uuid()),
    original_filename: Type.String(),
    content_type: Type.Union([
      Type.Literal("image/jpeg"),
      Type.Literal("image/png"),
      Type.Literal("image/webp"),
    ]),
    size_bytes: Type.Integer(),
    uploaded_by: uuid(),
    created_at: dateTime(),
  },
  strict,
);
const MaintenanceRoomBlockSchema = Type.Object(
  {
    id: uuid(),
    occurrence_id: nullable(uuid()),
    room_id: uuid(),
    room_number: Type.String(),
    status: Type.Union([Type.Literal("blocked"), Type.Literal("maintenance")]),
    label: nullable(Type.String()),
    start_date: date(),
    planned_end_date: date(),
    released_at: nullable(dateTime()),
    is_overdue: Type.Boolean(),
  },
  strict,
);
export const MaintenanceOccurrenceDetailSchema = Type.Intersect(
  [
    Type.Ref("MaintenanceOccurrenceSummary"),
    Type.Object(
      {
        discovered_at: dateTime(),
        triaged_by: nullable(uuid()),
        triaged_at: nullable(dateTime()),
        suspected_party: nullable(MaintenanceResponsiblePartySchema),
        confirmed_party: nullable(MaintenanceResponsiblePartySchema),
        liability_notes: nullable(Type.String()),
        duplicate_of_id: nullable(uuid()),
        canceled_reason: nullable(Type.String()),
        resolved_at: nullable(dateTime()),
        work_orders: Type.Array(Type.Ref("MaintenanceWorkOrder")),
        inspections: Type.Array(MaintenanceInspectionSchema),
        events: Type.Array(MaintenanceEventSchema),
        attachments: Type.Array(MaintenanceAttachmentSchema),
        room_blocks: Type.Array(MaintenanceRoomBlockSchema),
      },
      strict,
    ),
  ],
  { $id: "MaintenanceOccurrenceDetail" },
);
export const MaintenanceOccurrenceBodySchema = Type.Object(
  {
    category_id: uuid(),
    room_id: optionalNullable(uuid()),
    location_id: optionalNullable(uuid()),
    stay_id: optionalNullable(uuid()),
    kind: MaintenanceOccurrenceKindSchema,
    priority: Type.Optional(MaintenancePrioritySchema),
    description: Type.String({ minLength: 3, maxLength: 4000 }),
    discovered_at: Type.Optional(dateTime()),
    blocking_recommended: Type.Optional(Type.Boolean()),
  },
  { ...strict, $id: "MaintenanceOccurrenceCreateInput" },
);
export const MaintenanceWorkOrderBodySchema = Type.Object(
  {
    title: Type.String({ minLength: 3, maxLength: 160 }),
    instructions: Type.String({ minLength: 3, maxLength: 4000 }),
    priority: Type.Optional(MaintenancePrioritySchema),
    assigned_to: optionalNullable(uuid()),
    due_at: optionalNullable(dateTime()),
    requires_inspection: Type.Optional(Type.Boolean()),
  },
  { ...strict, $id: "MaintenanceWorkOrderCreateInput" },
);
const MaintenanceFinanceApprovalStatusSchema = Type.Union([
  Type.Literal("draft"),
  Type.Literal("submitted"),
  Type.Literal("approved"),
  Type.Literal("rejected"),
  Type.Literal("canceled"),
]);
const MaintenanceFinanceSettlementStatusSchema = Type.Union([
  Type.Literal("not_posted"),
  Type.Literal("open"),
  Type.Literal("partially_settled"),
  Type.Literal("settled"),
  Type.Literal("reversed"),
]);
const MaintenanceCostKindSchema = Type.Union([
  Type.Literal("material"),
  Type.Literal("labor"),
  Type.Literal("external_service"),
  Type.Literal("other"),
]);
export const MaintenanceCostItemBodySchema = Type.Object(
  {
    work_order_id: optionalNullable(uuid()),
    kind: MaintenanceCostKindSchema,
    description: Type.String({ minLength: 3, maxLength: 2000 }),
    quantity: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
    estimated_amount: optionalNullable(Type.Number({ minimum: 0 })),
    actual_amount: optionalNullable(Type.Number({ exclusiveMinimum: 0 })),
    counterparty: optionalNullable(Type.String({ maxLength: 240 })),
    supplier_id: optionalNullable(uuid()),
    contract_id: optionalNullable(uuid()),
    due_date: optionalNullable(date()),
    reference_code: optionalNullable(Type.String({ maxLength: 240 })),
  },
  { ...strict, $id: "MaintenanceCostItemInput" },
);
export const MaintenanceRecoveryBodySchema = Type.Object(
  {
    responsible_party: Type.Union([
      Type.Literal("guest"),
      Type.Literal("supplier"),
    ]),
    stay_id: optionalNullable(uuid()),
    debtor_name: optionalNullable(Type.String({ maxLength: 240 })),
    supplier_id: optionalNullable(uuid()),
    contract_id: optionalNullable(uuid()),
    charge_amount: Type.Number({ minimum: 0 }),
    waived_amount: Type.Optional(Type.Number({ minimum: 0 })),
    justification: Type.String({ minLength: 3, maxLength: 2000 }),
    due_date: optionalNullable(date()),
  },
  { ...strict, $id: "MaintenanceRecoveryInput" },
);
const MaintenanceFinancialSettlementSchema = Type.Object(
  {
    id: uuid(),
    cost_item_id: nullable(uuid()),
    recovery_id: nullable(uuid()),
    financial_transaction_id: uuid(),
    amount: Type.Number(),
    created_by: uuid(),
    created_at: dateTime(),
    reversal_of_id: nullable(uuid()),
  },
  strict,
);
const MaintenanceFinancialAttachmentSchema = Type.Object(
  {
    id: uuid(),
    occurrence_id: uuid(),
    cost_item_id: nullable(uuid()),
    recovery_id: nullable(uuid()),
    original_filename: Type.String(),
    content_type: Type.Union([
      Type.Literal("image/jpeg"),
      Type.Literal("image/png"),
      Type.Literal("image/webp"),
      Type.Literal("application/pdf"),
    ]),
    size_bytes: Type.Integer(),
    uploaded_by: uuid(),
    created_at: dateTime(),
    removed_at: nullable(dateTime()),
  },
  strict,
);
const MaintenanceFinanceCommonProperties = {
  id: uuid(),
  occurrence_id: uuid(),
  occurrence_code: Type.Optional(Type.String()),
  currency: Type.String(),
  approval_status: MaintenanceFinanceApprovalStatusSchema,
  settlement_status: MaintenanceFinanceSettlementStatusSchema,
  created_by: uuid(),
  proposer_name: Type.Optional(Type.String()),
  submitted_at: nullable(dateTime()),
  approved_by: nullable(uuid()),
  approved_at: nullable(dateTime()),
  decision_reason: nullable(Type.String()),
  settled_amount: Type.Number(),
  outstanding_amount: Type.Number(),
  settlements: Type.Optional(Type.Array(MaintenanceFinancialSettlementSchema)),
  attachments: Type.Optional(Type.Array(MaintenanceFinancialAttachmentSchema)),
  created_at: dateTime(),
  updated_at: dateTime(),
};
export const MaintenanceCostItemSchema = Type.Object(
  {
    ...MaintenanceFinanceCommonProperties,
    work_order_id: nullable(uuid()),
    kind: MaintenanceCostKindSchema,
    description: Type.String(),
    quantity: Type.Number(),
    estimated_amount: nullable(Type.Number()),
    actual_amount: nullable(Type.Number()),
    counterparty: nullable(Type.String()),
    supplier_id: Type.Optional(nullable(uuid())),
    contract_id: Type.Optional(nullable(uuid())),
    due_date: nullable(date()),
    reference_code: nullable(Type.String()),
  },
  { ...strict, $id: "MaintenanceCostItem" },
);
export const MaintenanceRecoverySchema = Type.Object(
  {
    ...MaintenanceFinanceCommonProperties,
    responsible_party: Type.Union([
      Type.Literal("guest"),
      Type.Literal("supplier"),
    ]),
    stay_id: nullable(uuid()),
    debtor_name: nullable(Type.String()),
    supplier_id: Type.Optional(nullable(uuid())),
    contract_id: Type.Optional(nullable(uuid())),
    charge_amount: Type.Number(),
    waived_amount: Type.Number(),
    justification: Type.String(),
    due_date: nullable(date()),
    folio_entry_id: nullable(uuid()),
  },
  { ...strict, $id: "MaintenanceRecovery" },
);
export const MaintenanceFinanceOccurrenceSchema = Type.Object(
  {
    occurrence_id: uuid(),
    currency: Type.String(),
    estimated_cost: Type.Number(),
    approved_cost: Type.Number(),
    settled_cost: Type.Number(),
    approved_recovery: Type.Number(),
    received_recovery: Type.Number(),
    net_result: Type.Number(),
    cost_items: Type.Array(Type.Ref("MaintenanceCostItem")),
    recoveries: Type.Array(Type.Ref("MaintenanceRecovery")),
  },
  { ...strict, $id: "MaintenanceFinanceOccurrence" },
);
export const MaintenanceFinanceSummarySchema = Type.Object(
  {
    currency: Type.String(),
    awaiting_approval: Type.Integer(),
    payable: Type.Integer(),
    receivable: Type.Integer(),
    overdue: Type.Integer(),
    settled: Type.Integer(),
    payable_amount: Type.Number(),
    receivable_amount: Type.Number(),
  },
  { ...strict, $id: "MaintenanceFinanceSummary" },
);
const MaintenanceRecurrenceUnitSchema = Type.Union([
  Type.Literal("daily"),
  Type.Literal("weekly"),
  Type.Literal("monthly"),
  Type.Literal("yearly"),
]);
const MaintenanceChecklistTaskBodySchema = Type.Object(
  {
    id: Type.Optional(uuid()),
    position: Type.Integer({ minimum: 0 }),
    description: Type.String({ minLength: 2, maxLength: 500 }),
    is_required: Type.Optional(Type.Boolean()),
  },
  strict,
);
export const MaintenancePreventivePlanBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 3, maxLength: 160 }),
    category_id: uuid(),
    room_id: optionalNullable(uuid()),
    location_id: optionalNullable(uuid()),
    assigned_to: uuid(),
    supplier_id: optionalNullable(uuid()),
    contract_id: optionalNullable(uuid()),
    priority: Type.Optional(MaintenancePrioritySchema),
    instructions: Type.String({ minLength: 3, maxLength: 4000 }),
    requires_inspection: Type.Optional(Type.Boolean()),
    blocking_recommended: Type.Optional(Type.Boolean()),
    recurrence_unit: MaintenanceRecurrenceUnitSchema,
    recurrence_interval: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 365 }),
    ),
    starts_on: date(),
    ends_on: optionalNullable(date()),
    local_time: Type.String({
      pattern: "^([01]\\d|2[0-3]):[0-5]\\d(:[0-5]\\d)?$",
    }),
    generation_lead_days: Type.Optional(
      Type.Integer({ minimum: 0, maximum: 365 }),
    ),
    completion_due_hours: Type.Optional(Type.Integer({ minimum: 1 })),
    tasks: Type.Array(MaintenanceChecklistTaskBodySchema, { maxItems: 100 }),
  },
  { ...strict, $id: "MaintenancePreventivePlanInput" },
);
export const MaintenancePreventivePlanSchema = Type.Intersect(
  [
    Type.Ref("MaintenancePreventivePlanInput"),
    Type.Object(
      {
        id: uuid(),
        hotel_id: uuid(),
        recurrence_interval: Type.Integer(),
        recurrence_day: Type.Integer(),
        generation_lead_days: Type.Integer(),
        completion_due_hours: Type.Integer(),
        next_due_date: date(),
        status: Type.Union([
          Type.Literal("active"),
          Type.Literal("paused"),
          Type.Literal("inactive"),
        ]),
        category_name: Type.Optional(Type.String()),
        target_name: Type.Optional(Type.String()),
        assignee_name: Type.Optional(Type.String()),
        supplier_name: Type.Optional(nullable(Type.String())),
        contract_number: Type.Optional(nullable(Type.String())),
        created_at: dateTime(),
        updated_at: dateTime(),
      },
      strict,
    ),
  ],
  { $id: "MaintenancePreventivePlan" },
);
export const MaintenancePreventiveRunSchema = Type.Object(
  {
    id: uuid(),
    plan_id: uuid(),
    scheduled_for: dateTime(),
    scheduled_local_date: date(),
    status: Type.Union([
      Type.Literal("scheduled"),
      Type.Literal("generated"),
      Type.Literal("deferred"),
      Type.Literal("skipped"),
      Type.Literal("rescheduled"),
    ]),
    occurrence_id: nullable(uuid()),
    work_order_id: nullable(uuid()),
    snapshot: Type.Record(Type.String(), Type.Unknown()),
    decision_reason: nullable(Type.String()),
    rescheduled_for: nullable(date()),
    created_at: dateTime(),
  },
  { ...strict, $id: "MaintenancePreventiveRun" },
);
export const MaintenanceSlaPolicySchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    category_id: nullable(uuid()),
    category_name: Type.Optional(nullable(Type.String())),
    priority: MaintenancePrioritySchema,
    name: Type.String(),
    response_hours: Type.Integer(),
    resolution_hours: Type.Integer(),
    is_active: Type.Boolean(),
    created_at: dateTime(),
    updated_at: dateTime(),
  },
  { ...strict, $id: "MaintenanceSlaPolicy" },
);
export const MaintenanceSupplierContactSchema = Type.Object(
  {
    id: uuid(),
    supplier_id: uuid(),
    name: Type.String(),
    role: nullable(Type.String()),
    email: nullable(Type.String()),
    phone: nullable(Type.String()),
    is_primary: Type.Boolean(),
    is_active: Type.Boolean(),
  },
  { ...strict, $id: "MaintenanceSupplierContact" },
);
export const MaintenanceContractSchema = Type.Object(
  {
    id: uuid(),
    supplier_id: uuid(),
    supplier_name: Type.Optional(Type.String()),
    contract_number: Type.String(),
    kind: Type.Union([
      Type.Literal("fixed"),
      Type.Literal("per_service"),
      Type.Literal("warranty"),
      Type.Literal("other"),
    ]),
    status: Type.Union([
      Type.Literal("draft"),
      Type.Literal("active"),
      Type.Literal("expired"),
      Type.Literal("terminated"),
    ]),
    starts_on: date(),
    ends_on: nullable(date()),
    renewal_notice_on: nullable(date()),
    scope_notes: nullable(Type.String()),
    response_hours: nullable(Type.Integer()),
    resolution_hours: nullable(Type.Integer()),
    commercial_terms: Type.Optional(nullable(Type.String())),
    contract_amount: Type.Optional(nullable(Type.Number())),
    currency: Type.Optional(nullable(Type.String())),
    created_at: dateTime(),
    updated_at: dateTime(),
    category_ids: Type.Optional(Type.Array(uuid())),
    location_ids: Type.Optional(Type.Array(uuid())),
    documents: Type.Optional(
      Type.Array(
        Type.Object(
          {
            id: uuid(),
            original_filename: Type.String(),
            content_type: Type.String(),
            size_bytes: Type.Integer(),
            created_at: dateTime(),
          },
          strict,
        ),
      ),
    ),
  },
  { ...strict, $id: "MaintenanceContract" },
);
export const MaintenanceSupplierSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    name: Type.String(),
    legal_name: nullable(Type.String()),
    tax_document: nullable(Type.String()),
    email: nullable(Type.String()),
    phone: nullable(Type.String()),
    specialties: Type.Array(Type.String()),
    notes: nullable(Type.String()),
    status: Type.Union([Type.Literal("active"), Type.Literal("inactive")]),
    contacts: Type.Optional(Type.Array(Type.Ref("MaintenanceSupplierContact"))),
    contracts: Type.Optional(Type.Array(Type.Ref("MaintenanceContract"))),
    documents: Type.Optional(
      Type.Array(
        Type.Object(
          {
            id: uuid(),
            original_filename: Type.String(),
            content_type: Type.String(),
            size_bytes: Type.Integer(),
            created_at: dateTime(),
          },
          strict,
        ),
      ),
    ),
    created_at: dateTime(),
    updated_at: dateTime(),
  },
  { ...strict, $id: "MaintenanceSupplier" },
);
export const MaintenanceNotificationSchema = Type.Object(
  {
    id: uuid(),
    kind: Type.String(),
    severity: Type.Union([
      Type.Literal("info"),
      Type.Literal("warning"),
      Type.Literal("critical"),
    ]),
    title: Type.String(),
    message: Type.String(),
    href: Type.String(),
    entity_type: Type.String(),
    entity_id: uuid(),
    status: Type.Union([
      Type.Literal("unread"),
      Type.Literal("read"),
      Type.Literal("dismissed"),
    ]),
    created_at: dateTime(),
  },
  { ...strict, $id: "MaintenanceNotification" },
);
export const MaintenanceAnalyticsSchema = Type.Object(
  {
    filters: Type.Record(Type.String(), Type.String()),
    backlog: Type.Integer(),
    critical_open: Type.Integer(),
    average_triage_hours: Type.Number(),
    average_resolution_hours: Type.Number(),
    sla_compliance_rate: Type.Number(),
    preventive_compliance_rate: Type.Number(),
    recurring_occurrences: Type.Integer(),
    blocked_room_days: Type.Number(),
    supplier_completion_rate: Type.Number(),
    aging: Type.Array(
      Type.Object({ bucket: Type.String(), count: Type.Integer() }, strict),
    ),
    series: Type.Array(
      Type.Object(
        { date: date(), opened: Type.Integer(), resolved: Type.Integer() },
        strict,
      ),
    ),
    financial: Type.Optional(
      Type.Object(
        {
          approved_cost: Type.Number(),
          approved_recovery: Type.Number(),
          net_result: Type.Number(),
          currency: Type.String(),
        },
        strict,
      ),
    ),
  },
  { ...strict, $id: "MaintenanceAnalytics" },
);
const MaintenanceAnalyticsFilterSchema = Type.Object(
  {
    from: Type.Optional(date()),
    to: Type.Optional(date()),
    category_id: Type.Optional(uuid()),
    priority: Type.Optional(MaintenancePrioritySchema),
    status: Type.Optional(MaintenanceOccurrenceStatusSchema),
    room_id: Type.Optional(uuid()),
    location_id: Type.Optional(uuid()),
    plan_id: Type.Optional(uuid()),
    supplier_id: Type.Optional(uuid()),
    format: Type.Optional(
      Type.Union([Type.Literal("json"), Type.Literal("csv")]),
    ),
  },
  strict,
);
export const MaintenanceAutomationRunSchema = Type.Object(
  {
    id: uuid(),
    run_key: Type.String(),
    status: Type.Union([
      Type.Literal("running"),
      Type.Literal("completed"),
      Type.Literal("failed"),
    ]),
    trigger_kind: Type.String(),
    local_date: nullable(date()),
    started_at: dateTime(),
    finished_at: nullable(dateTime()),
    duration_ms: nullable(Type.Integer()),
    counters: Type.Record(Type.String(), Type.Unknown()),
    error_message: nullable(Type.String()),
  },
  { ...strict, $id: "MaintenanceAutomationRun" },
);
const MaintenanceCatalogBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    description: optionalNullable(Type.String({ maxLength: 1000 })),
    display_order: Type.Optional(Type.Integer()),
    is_active: Type.Optional(Type.Boolean()),
    kind: Type.Optional(
      Type.Union([Type.Literal("area"), Type.Literal("equipment")]),
    ),
    parent_location_id: optionalNullable(uuid()),
    asset_tag: optionalNullable(Type.String({ maxLength: 120 })),
    manufacturer: optionalNullable(Type.String({ maxLength: 160 })),
    model: optionalNullable(Type.String({ maxLength: 160 })),
    serial_number: optionalNullable(Type.String({ maxLength: 160 })),
    installed_on: optionalNullable(date()),
    warranty_ends_on: optionalNullable(date()),
    supplier_id: optionalNullable(uuid()),
    contract_id: optionalNullable(uuid()),
    lifecycle_status: optionalNullable(
      Type.Union([
        Type.Literal("active"),
        Type.Literal("out_of_service"),
        Type.Literal("retired"),
      ]),
    ),
  },
  strict,
);
const MaintenanceTriageBodySchema = Type.Object(
  {
    category_id: Type.Optional(uuid()),
    priority: Type.Optional(MaintenancePrioritySchema),
    suspected_party: optionalNullable(MaintenanceResponsiblePartySchema),
    liability_notes: optionalNullable(Type.String({ maxLength: 2000 })),
  },
  strict,
);
const MaintenanceReasonBodySchema = Type.Object(
  { reason: Type.String({ minLength: 3, maxLength: 2000 }) },
  strict,
);
const MaintenanceDuplicateBodySchema = Type.Object(
  {
    duplicate_of_id: uuid(),
    reason: Type.String({ minLength: 3, maxLength: 2000 }),
  },
  strict,
);
const MaintenanceLiabilityBodySchema = Type.Object(
  {
    decision: Type.Union([
      Type.Literal("confirmed"),
      Type.Literal("dismissed"),
    ]),
    party: optionalNullable(MaintenanceResponsiblePartySchema),
    notes: Type.String({ minLength: 3, maxLength: 2000 }),
  },
  strict,
);
const MaintenanceTransitionBodySchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("assign"),
      Type.Literal("start"),
      Type.Literal("pause"),
      Type.Literal("wait"),
      Type.Literal("resume"),
      Type.Literal("complete"),
      Type.Literal("cancel"),
      Type.Literal("reopen"),
    ]),
    assigned_to: optionalNullable(uuid()),
    waiting_reason: Type.Optional(
      Type.Union([
        Type.Literal("parts"),
        Type.Literal("vendor"),
        Type.Literal("authorization"),
        Type.Literal("access"),
        Type.Literal("other"),
      ]),
    ),
    notes: Type.Optional(Type.String({ maxLength: 4000 })),
    diagnosis: Type.Optional(Type.String({ maxLength: 4000 })),
  },
  strict,
);
const MaintenanceInspectionBodySchema = Type.Object(
  {
    result: Type.Union([Type.Literal("approved"), Type.Literal("rejected")]),
    notes: Type.String({ minLength: 3, maxLength: 2000 }),
  },
  strict,
);
const MaintenanceBlockBodySchema = Type.Object(
  {
    start_date: date(),
    end_date: date(),
    status: Type.Optional(
      Type.Union([Type.Literal("blocked"), Type.Literal("maintenance")]),
    ),
    label: Type.Optional(Type.String({ maxLength: 240 })),
    conflict_acknowledgement: Type.Optional(
      Type.String({ minLength: 3, maxLength: 2000 }),
    ),
  },
  strict,
);
const MaintenanceAttachmentIntentBodySchema = Type.Object(
  {
    files: Type.Array(
      Type.Object(
        {
          filename: Type.String({ minLength: 1, maxLength: 255 }),
          content_type: Type.Union([
            Type.Literal("image/jpeg"),
            Type.Literal("image/png"),
            Type.Literal("image/webp"),
          ]),
          size_bytes: Type.Integer({ minimum: 1, maximum: 10485760 }),
        },
        strict,
      ),
      { minItems: 1, maxItems: 5 },
    ),
  },
  strict,
);
const MaintenanceAttachmentFinalizeBodySchema = Type.Object(
  {
    files: Type.Array(
      Type.Object(
        {
          storage_path: Type.String(),
          filename: Type.String(),
          content_type: Type.String(),
          size_bytes: Type.Integer(),
          work_order_id: optionalNullable(uuid()),
        },
        strict,
      ),
      { minItems: 1, maxItems: 5 },
    ),
  },
  strict,
);
const MaintenanceFinancialAttachmentIntentBodySchema = Type.Object(
  {
    target_type: Type.Union([
      Type.Literal("cost_item"),
      Type.Literal("recovery"),
    ]),
    target_id: uuid(),
    files: Type.Array(
      Type.Object(
        {
          filename: Type.String({ minLength: 1, maxLength: 255 }),
          content_type: Type.Union([
            Type.Literal("image/jpeg"),
            Type.Literal("image/png"),
            Type.Literal("image/webp"),
            Type.Literal("application/pdf"),
          ]),
          size_bytes: Type.Integer({ minimum: 1, maximum: 10485760 }),
        },
        strict,
      ),
      { minItems: 1, maxItems: 5 },
    ),
  },
  strict,
);
const MaintenanceFinancialAttachmentFinalizeBodySchema = Type.Object(
  {
    target_type: Type.Union([
      Type.Literal("cost_item"),
      Type.Literal("recovery"),
    ]),
    target_id: uuid(),
    files: Type.Array(
      Type.Object(
        {
          storage_path: Type.String(),
          filename: Type.String(),
          content_type: Type.String(),
          size_bytes: Type.Integer(),
        },
        strict,
      ),
      { minItems: 1, maxItems: 5 },
    ),
  },
  strict,
);
export const StayCheckoutBodySchema = Type.Object(
  {
    expected_version: Type.Optional(Type.Integer({ minimum: 0 })),
    idempotency_key: Type.Optional(uuid()),
    tenders: Type.Optional(
      Type.Array(Type.Ref("StayPaymentTenderInput"), { maxItems: 10 }),
    ),
    maintenance_acknowledged_occurrence_ids: Type.Optional(Type.Array(uuid())),
    maintenance_acknowledged_folio_entry_ids: Type.Optional(Type.Array(uuid())),
    maintenance_acknowledgement_note: Type.Optional(
      Type.String({ maxLength: 2000 }),
    ),
  },
  strict,
);
const StayFolioAllocationInputSchema = Type.Object(
  { debit_entry_id: uuid(), amount: Type.Number({ exclusiveMinimum: 0 }) },
  strict,
);
export const StayFolioSchema = Type.Object(
  {
    stay_id: uuid(),
    currency: Type.String(),
    entries: Type.Array(
      Type.Object(
        {
          id: uuid(),
          stay_id: uuid(),
          reservation_id: uuid(),
          direction: Type.Union([
            Type.Literal("debit"),
            Type.Literal("credit"),
          ]),
          kind: Type.Union([
            Type.Literal("lodging"),
            Type.Literal("maintenance_charge"),
            Type.Literal("consumption_charge"),
            Type.Literal("payment"),
            Type.Literal("refund"),
            Type.Literal("adjustment"),
          ]),
          amount: Type.Number(),
          currency: Type.String(),
          description: Type.String(),
          maintenance_occurrence_id: nullable(uuid()),
          consumption_order_id: Type.Optional(nullable(uuid())),
          financial_transaction_id: nullable(uuid()),
          reversed_entry_id: nullable(uuid()),
          allocated_amount: Type.Number(),
          open_amount: Type.Number(),
          posted_at: dateTime(),
        },
        strict,
      ),
    ),
    allocations: Type.Array(
      Type.Object(
        {
          id: uuid(),
          credit_entry_id: uuid(),
          debit_entry_id: uuid(),
          amount: Type.Number(),
          created_at: dateTime(),
        },
        strict,
      ),
    ),
    total_debits: Type.Number(),
    total_credits: Type.Number(),
    balance: Type.Number(),
    payment_status: PaymentStatusSchema,
    pending_maintenance_entry_ids: Type.Array(uuid()),
    lodging_total: Type.Optional(Type.Number()),
    consumption_total: Type.Optional(Type.Number()),
    maintenance_total: Type.Optional(Type.Number()),
    available_credit: Type.Optional(Type.Number()),
    checkout_balance: Type.Optional(Type.Number()),
    refundable_credit: Type.Optional(Type.Number()),
  },
  { ...strict, $id: "StayFolio" },
);
const StayPaymentTenderSchema = Type.Object(
  {
    id: uuid(),
    payment_method: ConsumptionPaymentMethodSchema,
    amount: Type.Number(),
    reference_code: nullable(Type.String()),
    financial_transaction_id: uuid(),
    folio_credit_entry_id: uuid(),
    display_order: Type.Integer(),
  },
  strict,
);
export const StayPaymentBatchSchema = Type.Object(
  {
    id: uuid(),
    kind: Type.Union([
      Type.Literal("regular"),
      Type.Literal("checkout"),
      Type.Literal("legacy"),
    ]),
    amount: Type.Number(),
    currency: Type.String(),
    note: nullable(Type.String()),
    created_by: nullable(uuid()),
    created_at: dateTime(),
    tenders: Type.Array(StayPaymentTenderSchema),
  },
  { ...strict, $id: "StayPaymentBatch" },
);
const ConsumptionCorrectionStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("approved"),
  Type.Literal("rejected"),
  Type.Literal("awaiting_refund"),
  Type.Literal("awaiting_partner_refund"),
  Type.Literal("completed"),
]);
const ConsumptionCorrectionItemSchema = Type.Object(
  {
    id: uuid(),
    order_item_id: uuid(),
    resulting_quantity: Type.Number(),
    additional_discount: Type.Number(),
    previous_quantity: Type.Number(),
    previous_discount: Type.Number(),
    previous_net: Type.Number(),
    resulting_net: Type.Number(),
    restock_quantity: Type.Number(),
    restock_location_id: nullable(uuid()),
    inventory_version: Type.Optional(nullable(Type.Integer())),
  },
  strict,
);
export const ConsumptionCorrectionSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    order_id: uuid(),
    stay_id: nullable(uuid()),
    kind: Type.Union([
      Type.Literal("partial_adjustment"),
      Type.Literal("full_void"),
    ]),
    status: ConsumptionCorrectionStatusSchema,
    reason: Type.String(),
    account_version: Type.Integer(),
    gross_reduction: Type.Number(),
    discount_increase: Type.Number(),
    net_reduction: Type.Number(),
    refundable_amount: Type.Number(),
    requested_by: uuid(),
    requested_by_name: optionalNullable(Type.String()),
    requested_at: dateTime(),
    decided_by: nullable(uuid()),
    decided_by_name: optionalNullable(Type.String()),
    decided_at: nullable(dateTime()),
    decision_reason: nullable(Type.String()),
    completed_at: nullable(dateTime()),
    reservation_code: optionalNullable(Type.String()),
    room_number: optionalNullable(Type.String()),
    point_name: optionalNullable(Type.String()),
    items: Type.Array(ConsumptionCorrectionItemSchema),
  },
  { ...strict, $id: "ConsumptionCorrection" },
);
export const StayRefundSchema = Type.Object(
  {
    id: uuid(),
    amount: Type.Number(),
    currency: Type.String(),
    payment_method: ConsumptionPaymentMethodSchema,
    original_payment_method: nullable(ConsumptionPaymentMethodSchema),
    method_override_reason: nullable(Type.String()),
    reference_code: nullable(Type.String()),
    reason: Type.String(),
    correction_id: nullable(uuid()),
    created_by: uuid(),
    created_at: dateTime(),
  },
  { ...strict, $id: "StayRefund" },
);
export const StayCheckoutRecordSchema = Type.Object(
  {
    id: uuid(),
    kind: Type.Union([Type.Literal("operational"), Type.Literal("legacy")]),
    account_version: Type.Integer(),
    currency: Type.String(),
    lodging_total: Type.Number(),
    consumption_total: Type.Number(),
    maintenance_total: Type.Number(),
    payment_total: Type.Number(),
    partner_direct_total: Type.Number(),
    courtesy_total: Type.Number(),
    discount_total: Type.Number(),
    voided_total: Type.Number(),
    exception_folio_entry_ids: Type.Array(uuid()),
    statement_snapshot: Type.Record(Type.String(), Type.Unknown()),
    checked_out_by: nullable(uuid()),
    checked_out_at: dateTime(),
  },
  { ...strict, $id: "StayCheckoutRecord" },
);
export const StayAccountSchema = Type.Object(
  {
    stay_id: uuid(),
    reservation_id: uuid(),
    reservation_code: nullable(Type.String()),
    room_number: Type.String(),
    guest_name: nullable(Type.String()),
    stay_status: ReservationStatusSchema,
    currency: Type.String(),
    version: Type.Integer(),
    status: Type.Union([
      Type.Literal("open"),
      Type.Literal("ready_to_checkout"),
      Type.Literal("closed"),
      Type.Literal("closed_with_exception"),
      Type.Literal("closed_with_pending_refund"),
    ]),
    folio: Type.Ref("StayFolio"),
    consumption_orders: Type.Array(Type.Ref("ConsumptionOrder")),
    corrections: Type.Array(Type.Ref("ConsumptionCorrection")),
    payment_batches: Type.Array(Type.Ref("StayPaymentBatch")),
    refunds: Type.Array(Type.Ref("StayRefund")),
    checkout_record: nullable(
      Type.Object(
        {
          id: uuid(),
          kind: Type.Union([
            Type.Literal("operational"),
            Type.Literal("legacy"),
          ]),
          account_version: Type.Integer(),
          currency: Type.String(),
          lodging_total: Type.Number(),
          consumption_total: Type.Number(),
          maintenance_total: Type.Number(),
          payment_total: Type.Number(),
          partner_direct_total: Type.Number(),
          courtesy_total: Type.Number(),
          discount_total: Type.Number(),
          voided_total: Type.Number(),
          exception_folio_entry_ids: Type.Array(uuid()),
          statement_snapshot: Type.Record(Type.String(), Type.Unknown()),
          checked_out_by: nullable(uuid()),
          checked_out_at: dateTime(),
        },
        strict,
      ),
    ),
  },
  { ...strict, $id: "StayAccount" },
);
const StayFolioPreviewBodySchema = Type.Object(
  { amount: Type.Number({ exclusiveMinimum: 0 }) },
  strict,
);
const StayFolioAllocationPreviewSchema = Type.Object(
  {
    amount: Type.Number(),
    allocations: Type.Array(StayFolioAllocationInputSchema),
    unallocated_amount: Type.Number(),
  },
  strict,
);
const MaintenanceFinanceTransitionBodySchema = Type.Object(
  {
    action: Type.Union([
      Type.Literal("submit"),
      Type.Literal("approve"),
      Type.Literal("reject"),
      Type.Literal("cancel"),
    ]),
    reason: Type.Optional(Type.String({ minLength: 3, maxLength: 2000 })),
  },
  strict,
);
const MaintenanceFinanceSettlementBodySchema = Type.Object(
  {
    amount: Type.Number({ exclusiveMinimum: 0 }),
    method: Type.String({ minLength: 1, maxLength: 120 }),
    settled_at: Type.Optional(dateTime()),
    note: Type.Optional(Type.String({ maxLength: 2000 })),
    reference_code: Type.Optional(Type.String({ maxLength: 240 })),
    allocations: Type.Optional(Type.Array(StayFolioAllocationInputSchema)),
  },
  strict,
);
const MaintenanceSummarySchema = Type.Object(
  {
    open: Type.Integer(),
    assigned_to_me: Type.Integer(),
    unassigned: Type.Integer(),
    overdue: Type.Integer(),
    awaiting_inspection: Type.Integer(),
    blocked_rooms: Type.Integer(),
  },
  strict,
);
const MaintenanceReferenceDataSchema = Type.Object(
  {
    categories: Type.Array(Type.Ref("MaintenanceCategory")),
    locations: Type.Array(Type.Ref("MaintenanceLocation")),
    rooms: Type.Array(
      Type.Object(
        { id: uuid(), room_number: Type.String(), room_type: Type.String() },
        strict,
      ),
    ),
    stays: Type.Array(
      Type.Object(
        {
          id: uuid(),
          room_id: uuid(),
          reservation_code: nullable(Type.String()),
          customer_name: nullable(Type.String()),
          status: ReservationStatusSchema,
        },
        strict,
      ),
    ),
    assignable_users: Type.Array(
      Type.Object({ id: uuid(), name: Type.String() }, strict),
    ),
  },
  strict,
);
const MaintenanceOccurrenceListSchema = Type.Object(
  {
    items: Type.Array(Type.Ref("MaintenanceOccurrenceSummary")),
    page: Type.Integer(),
    page_size: Type.Integer(),
    total: Type.Integer(),
  },
  strict,
);
const MaintenanceUploadIntentSchema = Type.Object(
  {
    items: Type.Array(
      Type.Object(
        {
          storage_path: Type.String(),
          token: Type.String(),
          signed_url: Type.String(),
        },
        strict,
      ),
    ),
  },
  strict,
);
const MaintenanceAttachmentAccessSchema = Type.Object(
  { signed_url: Type.String(), expires_in: Type.Integer() },
  strict,
);
const CalendarBreakdownSchema = Type.Object(
  {
    room_id: uuid(),
    room_number: Type.String(),
    room_type: Type.String(),
    date: date(),
    base_daily_rate: Type.Number(),
    season_extra_rate: Type.Number(),
    final_daily_rate: Type.Number(),
  },
  strict,
);
export const CalendarBookingResponseSchema = Type.Object(
  {
    reservation_id: Type.Optional(uuid()),
    reservation_code: Type.Optional(Type.String()),
    customer_id: Type.Optional(uuid()),
    stay_ids: Type.Optional(Type.Array(uuid())),
    total_price: Type.Number(),
    nights_count: Type.Integer(),
    rooms_count: Type.Integer(),
    breakdown: Type.Array(CalendarBreakdownSchema),
  },
  { ...strict, $id: "CalendarBookingResponse" },
);
export const ReservationCalendarSchema = Type.Object(
  {
    window_start: date(),
    window_end: date(),
    days: Type.Array(
      Type.Object(
        {
          date: date(),
          day_number: Type.Integer(),
          weekday_short: Type.String(),
        },
        strict,
      ),
    ),
    rooms: Type.Array(
      Type.Object(
        {
          room_id: uuid(),
          room_number: Type.String(),
          room_type: Type.String(),
          max_occupancy: Type.Integer(),
        },
        strict,
      ),
    ),
    stays: Type.Array(
      Type.Object(
        {
          id: uuid(),
          room_id: uuid(),
          reservation_id: uuid(),
          reservation_code: nullable(Type.String()),
          stay_status: nullable(ReservationStatusSchema),
          total_price_estimated: nullable(Type.Number()),
          total_paid: Type.Number(),
          stay_payment_status: PaymentStatusSchema,
          customer_name: nullable(Type.String()),
          checkin_date_expected: date(),
          checkout_date_expected: date(),
          start_date: date(),
          end_date: date(),
          start_half: nullable(
            Type.Union([Type.Literal("left"), Type.Literal("right")]),
          ),
          end_half: nullable(
            Type.Union([Type.Literal("left"), Type.Literal("right")]),
          ),
        },
        strict,
      ),
    ),
    blocks: Type.Array(
      Type.Object(
        {
          id: uuid(),
          room_id: uuid(),
          label: nullable(Type.String()),
          status: Type.String(),
          start_date: date(),
          end_date: date(),
          maintenance_occurrence_id: Type.Optional(nullable(uuid())),
          occurrence_code: Type.Optional(nullable(Type.String())),
          is_overdue: Type.Optional(Type.Boolean()),
        },
        strict,
      ),
    ),
    legend: Type.Array(
      Type.Object(
        { key: Type.String(), label: Type.String(), color: Type.String() },
        strict,
      ),
    ),
  },
  { ...strict, $id: "ReservationCalendar" },
);
const StayPaymentSchema = Type.Object(
  {
    id: uuid(),
    stay_id: uuid(),
    amount: Type.Number(),
    method: Type.String(),
    note: nullable(Type.String()),
    paid_at: Type.String(),
    created_at: Type.String(),
    created_by: nullable(uuid()),
  },
  strict,
);
export const StayPanelSchema = Type.Object(
  {
    stay: Type.Object(
      {
        id: uuid(),
        reservation_id: uuid(),
        reservation_code: nullable(Type.String()),
        room_id: uuid(),
        room_number: Type.String(),
        room_type: Type.String(),
        customer_name: nullable(Type.String()),
        stay_status: ReservationStatusSchema,
        checkin_date_expected: date(),
        checkout_date_expected: date(),
        checkin_date_actual: nullable(Type.String()),
        checkout_date_actual: nullable(Type.String()),
        total_price_estimated: Type.Number(),
        total_paid: Type.Number(),
        stay_payment_status: PaymentStatusSchema,
      },
      strict,
    ),
    reservation: Type.Object(
      {
        id: uuid(),
        code: nullable(Type.String()),
        total_due: Type.Number(),
        total_paid: Type.Number(),
        payment_status: PaymentStatusSchema,
      },
      strict,
    ),
    hotel: Type.Object(
      {
        id: uuid(),
        timezone: Type.String(),
        checkin_time_start: nullable(Type.String()),
        checkin_time_limit: nullable(Type.String()),
        checkout_time_start: nullable(Type.String()),
        checkout_time_limit: nullable(Type.String()),
      },
      strict,
    ),
    eligibility: Type.Object(
      {
        can_checkin: Type.Boolean(),
        checkin_block_reason: nullable(Type.String()),
        can_checkout: Type.Boolean(),
        checkout_block_reason: nullable(Type.String()),
        can_no_show: Type.Boolean(),
        no_show_block_reason: nullable(Type.String()),
        can_cancel: Type.Boolean(),
        cancel_block_reason: nullable(Type.String()),
      },
      strict,
    ),
    payments: Type.Array(StayPaymentSchema),
    folio: Type.Optional(Type.Ref("StayFolio")),
    maintenance_occurrences: Type.Optional(
      Type.Array(Type.Ref("MaintenanceOccurrenceSummary")),
    ),
    maintenance_acknowledgement_required: Type.Optional(Type.Boolean()),
    maintenance_financial_acknowledgement_required: Type.Optional(
      Type.Boolean(),
    ),
    maintenance_pending_folio_entry_ids: Type.Optional(Type.Array(uuid())),
    pending_consumption_count: Type.Optional(Type.Integer({ minimum: 0 })),
    pending_consumption_balance: Type.Optional(Type.Number({ minimum: 0 })),
    pending_consumption_folio_entry_ids: Type.Optional(Type.Array(uuid())),
  },
  { ...strict, $id: "StayPanel" },
);

// These assertions keep the runtime contract assignable to the public client types.
type Assert<T extends true> = T;
type Compatible<S extends TSchema, T> = Static<S> extends T ? true : false;
type ContractCompatibility = [
  Assert<Compatible<typeof LoginBodySchema, LoginRequest>>,
  Assert<Compatible<typeof HotelBodySchema, AdminHotelCreateInput>>,
  Assert<Compatible<typeof UserBodySchema, AdminUserCreateInput>>,
  Assert<Compatible<typeof RoleBodySchema, AdminRoleCreateInput>>,
  Assert<Compatible<typeof PermissionBodySchema, AdminPermissionCreateInput>>,
  Assert<Compatible<typeof RoomBodySchema, AdminRoomCreateInput>>,
  Assert<Compatible<typeof CustomerBodySchema, AdminCustomerCreateInput>>,
  Assert<Compatible<typeof ProductBodySchema, AdminProductCreateInput>>,
  Assert<
    Compatible<typeof CommercialPartnerBodySchema, AdminCommercialPartnerInput>
  >,
  Assert<
    Compatible<
      typeof CommercialPartnerContactBodySchema,
      AdminCommercialPartnerContactInput
    >
  >,
  Assert<
    Compatible<
      typeof CommercialAgreementBodySchema,
      AdminCommercialAgreementCreateInput
    >
  >,
  Assert<
    Compatible<typeof ConsumptionPointBodySchema, AdminConsumptionPointInput>
  >,
  Assert<
    Compatible<
      typeof ConsumptionOfferBatchBodySchema,
      AdminConsumptionOfferBatchInput
    >
  >,
  Assert<
    Compatible<
      typeof ConsumptionReorderBodySchema,
      AdminConsumptionReorderInput
    >
  >,
  Assert<Compatible<typeof SeasonBodySchema, AdminSeasonCreateInput>>,
  Assert<
    Compatible<typeof SeasonRoomRateBodySchema, AdminSeasonRoomRateCreateInput>
  >,
  Assert<
    Compatible<
      typeof FinancialTransactionBodySchema,
      AdminFinancialTransactionCreateInput
    >
  >,
  Assert<
    Compatible<
      typeof CalendarBookingBodySchema,
      AdminReservationCalendarBookingCreateInput
    >
  >,
  Assert<Compatible<typeof StayPaymentBodySchema, AdminStayPaymentCreateInput>>,
  Assert<
    Compatible<
      typeof ConsumptionCorrectionDecisionBodySchema,
      AdminConsumptionCorrectionDecisionInput
    >
  >,
  Assert<Compatible<typeof StayRefundBodySchema, AdminStayRefundInput>>,
  Assert<
    Compatible<
      typeof PartnerRefundConfirmationBodySchema,
      AdminPartnerRefundConfirmationInput
    >
  >,
  Assert<
    Compatible<
      typeof MaintenanceCostItemBodySchema,
      AdminMaintenanceCostItemInput
    >
  >,
  Assert<
    Compatible<
      typeof MaintenanceRecoveryBodySchema,
      AdminMaintenanceRecoveryInput
    >
  >,
  Assert<
    Compatible<
      typeof MaintenanceOccurrenceBodySchema,
      AdminMaintenanceOccurrenceCreateInput
    >
  >,
  Assert<
    Compatible<
      typeof MaintenanceWorkOrderBodySchema,
      AdminMaintenanceWorkOrderCreateInput
    >
  >,
];
export type { ContractCompatibility };

export const API_COMPONENT_SCHEMAS = [
  ApiErrorSchema,
  LoginBodySchema,
  HotelBodySchema,
  HotelUpdateSchema,
  UserBodySchema,
  UserUpdateSchema,
  RoleBodySchema,
  RoleUpdateSchema,
  PermissionBodySchema,
  PermissionUpdateSchema,
  RoomBodySchema,
  RoomUpdateSchema,
  CustomerBodySchema,
  CustomerUpdateSchema,
  ProductBodySchema,
  ProductUpdateSchema,
  ProductCategoryBodySchema,
  ProductCategoryUpdateSchema,
  CommercialPartnerBodySchema,
  CommercialPartnerUpdateSchema,
  CommercialPartnerContactBodySchema,
  CommercialPartnerContactUpdateSchema,
  CommercialAgreementRevisionBodySchema,
  CommercialAgreementRevisionUpdateSchema,
  CommercialAgreementBodySchema,
  CommercialAgreementTerminateBodySchema,
  CommercialAgreementPointsBodySchema,
  ConsumptionBillingPolicySchema,
  ConsumptionPointBillingPolicySchema,
  ConsumptionPointBodySchema,
  ConsumptionPointUpdateSchema,
  ConsumptionOfferPolicySchema,
  ConsumptionOfferBatchBodySchema,
  ConsumptionOfferUpdateSchema,
  ConsumptionReorderBodySchema,
  ConsumptionOrderLineBodySchema,
  ConsumptionOrderBodySchema,
  SeasonBodySchema,
  SeasonUpdateSchema,
  SeasonRoomRateBodySchema,
  SeasonRoomRateUpdateSchema,
  FinancialTransactionBodySchema,
  FinancialTransactionUpdateSchema,
  CalendarBookingBodySchema,
  StayPaymentBodySchema,
  StayPaymentTenderBodySchema,
  StayPaymentBatchBodySchema,
  StayPaymentBatchPreviewSchema,
  ConsumptionCorrectionItemBodySchema,
  ConsumptionCorrectionBodySchema,
  ConsumptionCorrectionDecisionBodySchema,
  StayRefundBodySchema,
  PartnerRefundConfirmationBodySchema,
  InventorySettingsBodySchema,
  InventoryLocationBodySchema,
  InventoryLocationUpdateSchema,
  InventoryPositionBodySchema,
  InventoryPositionUpdateSchema,
  InventoryDocumentBodySchema,
  InventoryTransferBodySchema,
  InventoryCountBodySchema,
  InventoryCountItemsBodySchema,
  StayFolioSchema,
  StayPaymentBatchSchema,
  ConsumptionCorrectionSchema,
  StayRefundSchema,
  StayCheckoutRecordSchema,
  StayAccountSchema,
  MaintenanceOccurrenceBodySchema,
  MaintenanceWorkOrderBodySchema,
  MaintenanceCostItemBodySchema,
  MaintenanceRecoveryBodySchema,
  MaintenancePreventivePlanBodySchema,
  HotelSchema,
  UserSchema,
  RoleSchema,
  PermissionSchema,
  RoomSchema,
  CustomerSchema,
  ProductSchema,
  CommercialPartnerSummarySchema,
  ProductProviderSchema,
  ProductCategorySchema,
  CatalogAuditEventSchema,
  CommercialPartnerContactSchema,
  CommercialPartnerSchema,
  CommercialAgreementRevisionSchema,
  CommercialAgreementSchema,
  CommercialAgreementEligibilitySchema,
  CommercialAuditEventSchema,
  ConsumptionPointSchema,
  ConsumptionOfferSchema,
  ConsumptionConfigurationAuditEventSchema,
  InventorySettingsSchema,
  InventoryLocationSchema,
  InventoryPositionSchema,
  InventoryMovementSchema,
  InventoryAuditEventSchema,
  InventoryCountSchema,
  ConsumptionEligibleStaySchema,
  ConsumptionContextGuestSchema,
  ConsumptionContextOfferSchema,
  ConsumptionOperationalContextSchema,
  ConsumptionOrderItemSchema,
  ConsumptionOrderEventSchema,
  ConsumptionOrderSchema,
  ConsumptionOrderHistorySchema,
  SeasonSchema,
  SeasonRoomRateSchema,
  FinancialTransactionSchema,
  AuthUserSchema,
  LoginResponseSchema,
  MeResponseSchema,
  UserReferenceDataSchema,
  RoleReferenceDataSchema,
  CalendarBookingResponseSchema,
  ReservationCalendarSchema,
  StayPanelSchema,
  MaintenanceCategorySchema,
  MaintenanceLocationSchema,
  MaintenanceOccurrenceSummarySchema,
  MaintenanceWorkOrderSchema,
  MaintenanceOccurrenceDetailSchema,
  MaintenanceCostItemSchema,
  MaintenanceRecoverySchema,
  MaintenanceFinanceOccurrenceSchema,
  MaintenanceFinanceSummarySchema,
  MaintenancePreventivePlanSchema,
  MaintenancePreventiveRunSchema,
  MaintenanceSlaPolicySchema,
  MaintenanceSupplierContactSchema,
  MaintenanceContractSchema,
  MaintenanceSupplierSchema,
  MaintenanceNotificationSchema,
  MaintenanceAnalyticsSchema,
  MaintenanceAutomationRunSchema,
] as const;

const AuthHeadersSchema = Type.Object(
  {
    authorization: Type.Optional(Type.String()),
    "x-active-hotel-id": Type.Optional(Type.String()),
  },
  { additionalProperties: true },
);
const IdParamsSchema = Type.Object({ id: uuid() }, strict);
const OkSchema = Type.Object({ ok: Type.Boolean() }, strict);
const IncludeArchivedQuerySchema = Type.Object(
  { include_archived: Type.Optional(Type.Boolean()) },
  strict,
);
const listSchema = (item: TSchema) =>
  Type.Object({ items: Type.Array(item) }, strict);
const itemSchema = (item: TSchema) => Type.Object({ item }, strict);
const adminErrors = {
  400: ApiErrorSchema,
  401: ApiErrorSchema,
  403: ApiErrorSchema,
  404: ApiErrorSchema,
  409: ApiErrorSchema,
  500: ApiErrorSchema,
};

export type ApiRouteContract = {
  operationId: string;
  tags: string[];
  description: string;
  security?: Array<Record<string, string[]>>;
  headers?: TSchema;
  params?: TSchema;
  querystring?: TSchema;
  body?: TSchema;
  response: Record<number, TSchema>;
};

const route = (
  operationId: string,
  tag: string,
  description: string,
  config: Partial<ApiRouteContract> & Pick<ApiRouteContract, "response">,
): ApiRouteContract => ({
  operationId,
  tags: [tag],
  description,
  ...config,
});
const admin = (
  operationId: string,
  tag: string,
  description: string,
  response: TSchema,
  config: Partial<ApiRouteContract> = {},
): ApiRouteContract =>
  route(operationId, tag, description, {
    headers: AuthHeadersSchema,
    security: [{ bearerAuth: [] }],
    ...config,
    response: { 200: response, ...adminErrors },
  });
const crud = (
  base: string,
  tag: string,
  path: string,
  entity: TSchema,
  createBody: TSchema,
  updateBody: TSchema,
): Record<string, ApiRouteContract> => ({
  [`GET ${path}`]: admin(
    `list${base}`,
    tag,
    `Lista ${tag.toLowerCase()}.`,
    listSchema(entity),
  ),
  [`POST ${path}`]: route(
    `create${base}`,
    tag,
    `Cria um registro de ${tag.toLowerCase()}.`,
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: createBody,
      response: { 201: itemSchema(entity), ...adminErrors },
    },
  ),
  [`PUT ${path}/:id`]: admin(
    `update${base}`,
    tag,
    `Atualiza um registro de ${tag.toLowerCase()}.`,
    itemSchema(entity),
    { params: IdParamsSchema, body: updateBody },
  ),
  [`DELETE ${path}/:id`]: admin(
    `delete${base}`,
    tag,
    `Remove um registro de ${tag.toLowerCase()}.`,
    OkSchema,
    { params: IdParamsSchema },
  ),
});

export const API_ROUTE_CONTRACTS: Readonly<Record<string, ApiRouteContract>> = {
  "GET /health": route(
    "getHealth",
    "System",
    "Verifica a disponibilidade do serviço.",
    {
      response: {
        200: Type.Object(
          { status: Type.Literal("ok"), service: Type.String() },
          strict,
        ),
      },
    },
  ),
  "POST /auth/login": route(
    "login",
    "Authentication",
    "Autentica um usuário e emite uma sessão.",
    {
      body: LoginBodySchema,
      response: {
        200: LoginResponseSchema,
        400: ApiErrorSchema,
        401: ApiErrorSchema,
        429: ApiErrorSchema,
        500: ApiErrorSchema,
      },
    },
  ),
  "GET /auth/me": route(
    "getCurrentUser",
    "Authentication",
    "Retorna o usuário da sessão atual.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      response: {
        200: MeResponseSchema,
        401: ApiErrorSchema,
        500: ApiErrorSchema,
      },
    },
  ),
  ...crud(
    "Hotel",
    "Hotels",
    "/admin/hotels",
    HotelSchema,
    HotelBodySchema,
    HotelUpdateSchema,
  ),
  "GET /admin/users/reference-data": admin(
    "getUserReferenceData",
    "Users",
    "Lista hotéis e papéis disponíveis para usuários.",
    UserReferenceDataSchema,
  ),
  ...crud(
    "User",
    "Users",
    "/admin/users",
    UserSchema,
    UserBodySchema,
    UserUpdateSchema,
  ),
  "GET /admin/roles/reference-data": admin(
    "getRoleReferenceData",
    "Roles",
    "Lista hotéis e permissões disponíveis para papéis.",
    RoleReferenceDataSchema,
  ),
  ...crud(
    "Role",
    "Roles",
    "/admin/roles",
    RoleSchema,
    RoleBodySchema,
    RoleUpdateSchema,
  ),
  ...crud(
    "Permission",
    "Permissions",
    "/admin/permissions",
    PermissionSchema,
    PermissionBodySchema,
    PermissionUpdateSchema,
  ),
  ...crud(
    "Room",
    "Rooms",
    "/admin/rooms",
    RoomSchema,
    RoomBodySchema,
    RoomUpdateSchema,
  ),
  ...crud(
    "Customer",
    "Customers",
    "/admin/customers",
    CustomerSchema,
    CustomerBodySchema,
    CustomerUpdateSchema,
  ),
  "GET /admin/products": admin(
    "listProducts",
    "Products",
    "Lista produtos e serviços do catálogo do hotel ativo.",
    listSchema(ProductSchema),
    { querystring: IncludeArchivedQuerySchema },
  ),
  "POST /admin/products": route(
    "createProduct",
    "Products",
    "Cria um produto ou serviço no catálogo do hotel ativo.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: ProductBodySchema,
      response: { 201: itemSchema(ProductSchema), ...adminErrors },
    },
  ),
  "PUT /admin/products/:id": admin(
    "updateProduct",
    "Products",
    "Atualiza um produto ou serviço do hotel ativo.",
    itemSchema(ProductSchema),
    { params: IdParamsSchema, body: ProductUpdateSchema },
  ),
  "POST /admin/products/:id/archive": admin(
    "archiveProduct",
    "Products",
    "Arquiva logicamente um item preservando seu histórico.",
    itemSchema(ProductSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/products/:id/restore": admin(
    "restoreProduct",
    "Products",
    "Restaura um item previamente arquivado.",
    itemSchema(ProductSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/products/:id/history": admin(
    "listProductHistory",
    "Products",
    "Lista a trilha imutável de alterações do item.",
    listSchema(CatalogAuditEventSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/product-categories": admin(
    "listProductCategories",
    "Products",
    "Lista categorias do catálogo do hotel ativo.",
    listSchema(ProductCategorySchema),
    { querystring: IncludeArchivedQuerySchema },
  ),
  "POST /admin/product-categories": route(
    "createProductCategory",
    "Products",
    "Cria uma categoria no catálogo do hotel ativo.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: ProductCategoryBodySchema,
      response: { 201: itemSchema(ProductCategorySchema), ...adminErrors },
    },
  ),
  "PUT /admin/product-categories/:id": admin(
    "updateProductCategory",
    "Products",
    "Atualiza nome, ordem ou situação de uma categoria.",
    itemSchema(ProductCategorySchema),
    { params: IdParamsSchema, body: ProductCategoryUpdateSchema },
  ),
  "POST /admin/product-categories/:id/archive": admin(
    "archiveProductCategory",
    "Products",
    "Arquiva logicamente uma categoria.",
    itemSchema(ProductCategorySchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/product-categories/:id/restore": admin(
    "restoreProductCategory",
    "Products",
    "Restaura uma categoria previamente arquivada.",
    itemSchema(ProductCategorySchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/commercial-partners": admin(
    "listCommercialPartners",
    "Commercial partners",
    "Lista parceiros comerciais do hotel ativo.",
    listSchema(CommercialPartnerSchema),
    { querystring: IncludeArchivedQuerySchema },
  ),
  "POST /admin/commercial-partners": route(
    "createCommercialPartner",
    "Commercial partners",
    "Cria uma empresa parceira no hotel ativo.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: CommercialPartnerBodySchema,
      response: { 201: itemSchema(CommercialPartnerSchema), ...adminErrors },
    },
  ),
  "PUT /admin/commercial-partners/:id": admin(
    "updateCommercialPartner",
    "Commercial partners",
    "Atualiza cadastro e situação de um parceiro.",
    itemSchema(CommercialPartnerSchema),
    { params: IdParamsSchema, body: CommercialPartnerUpdateSchema },
  ),
  "POST /admin/commercial-partners/:id/archive": admin(
    "archiveCommercialPartner",
    "Commercial partners",
    "Arquiva um parceiro preservando seus vínculos.",
    itemSchema(CommercialPartnerSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/commercial-partners/:id/restore": admin(
    "restoreCommercialPartner",
    "Commercial partners",
    "Restaura um parceiro arquivado.",
    itemSchema(CommercialPartnerSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/commercial-partners/:id/contacts": route(
    "createCommercialPartnerContact",
    "Commercial partners",
    "Adiciona um contato ao parceiro.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      params: IdParamsSchema,
      body: CommercialPartnerContactBodySchema,
      response: {
        201: itemSchema(CommercialPartnerContactSchema),
        ...adminErrors,
      },
    },
  ),
  "PUT /admin/commercial-partner-contacts/:id": admin(
    "updateCommercialPartnerContact",
    "Commercial partners",
    "Atualiza um contato comercial.",
    itemSchema(CommercialPartnerContactSchema),
    { params: IdParamsSchema, body: CommercialPartnerContactUpdateSchema },
  ),
  "POST /admin/commercial-partner-contacts/:id/archive": admin(
    "archiveCommercialPartnerContact",
    "Commercial partners",
    "Arquiva um contato comercial.",
    itemSchema(CommercialPartnerContactSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/commercial-partner-contacts/:id/restore": admin(
    "restoreCommercialPartnerContact",
    "Commercial partners",
    "Restaura um contato comercial.",
    itemSchema(CommercialPartnerContactSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/commercial-partners/:id/history": admin(
    "listCommercialPartnerHistory",
    "Commercial partners",
    "Lista a auditoria imutável do parceiro e contatos.",
    listSchema(CommercialAuditEventSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/commercial-agreements": admin(
    "listCommercialAgreements",
    "Commercial agreements",
    "Lista acordos comerciais do hotel ativo.",
    listSchema(CommercialAgreementSchema),
    { querystring: IncludeArchivedQuerySchema },
  ),
  "POST /admin/commercial-agreements": route(
    "createCommercialAgreement",
    "Commercial agreements",
    "Cria um acordo com sua primeira revisão em rascunho.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: CommercialAgreementBodySchema,
      response: { 201: itemSchema(CommercialAgreementSchema), ...adminErrors },
    },
  ),
  "POST /admin/commercial-agreements/:id/archive": admin(
    "archiveCommercialAgreement",
    "Commercial agreements",
    "Arquiva um acordo comercial sem apagar suas revisões.",
    itemSchema(CommercialAgreementSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/commercial-agreements/:id/restore": admin(
    "restoreCommercialAgreement",
    "Commercial agreements",
    "Restaura um acordo comercial e sua configuração preservada.",
    itemSchema(CommercialAgreementSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/commercial-agreements/:id": admin(
    "getCommercialAgreement",
    "Commercial agreements",
    "Consulta acordo, revisões e estado efetivo.",
    itemSchema(CommercialAgreementSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/commercial-agreements/:id/revisions": route(
    "createCommercialAgreementRevision",
    "Commercial agreements",
    "Cria uma revisão em rascunho.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      params: IdParamsSchema,
      body: CommercialAgreementRevisionBodySchema,
      response: {
        201: itemSchema(CommercialAgreementRevisionSchema),
        ...adminErrors,
      },
    },
  ),
  "PUT /admin/commercial-agreement-revisions/:id": admin(
    "updateCommercialAgreementRevision",
    "Commercial agreements",
    "Edita somente uma revisão em rascunho.",
    itemSchema(CommercialAgreementRevisionSchema),
    { params: IdParamsSchema, body: CommercialAgreementRevisionUpdateSchema },
  ),
  "PUT /admin/commercial-agreement-revisions/:id/points": admin(
    "setCommercialAgreementRevisionPoints",
    "Commercial agreements",
    "Substitui atomicamente os pontos de uma revisão em rascunho.",
    itemSchema(CommercialAgreementRevisionSchema),
    { params: IdParamsSchema, body: CommercialAgreementPointsBodySchema },
  ),
  "POST /admin/commercial-agreement-revisions/:id/activate": admin(
    "activateCommercialAgreementRevision",
    "Commercial agreements",
    "Ativa a revisão e encerra a anterior atomicamente.",
    itemSchema(CommercialAgreementRevisionSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/commercial-agreement-revisions/:id/terminate": admin(
    "terminateCommercialAgreementRevision",
    "Commercial agreements",
    "Encerra uma revisão ativada.",
    itemSchema(CommercialAgreementRevisionSchema),
    { params: IdParamsSchema, body: CommercialAgreementTerminateBodySchema },
  ),
  "GET /admin/commercial-agreements/:id/history": admin(
    "listCommercialAgreementHistory",
    "Commercial agreements",
    "Lista a auditoria imutável do acordo e suas revisões.",
    listSchema(CommercialAuditEventSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/commercial-agreement-eligibility": admin(
    "listEligibleCommercialAgreements",
    "Commercial agreements",
    "Resolve acordos elegíveis para um produto e ponto.",
    listSchema(CommercialAgreementEligibilitySchema),
    {
      querystring: Type.Object(
        { product_id: uuid(), point_id: uuid() },
        strict,
      ),
    },
  ),
  "GET /admin/consumption-points": admin(
    "listConsumptionPoints",
    "Consumption settings",
    "Lista os pontos de consumo do hotel ativo.",
    listSchema(ConsumptionPointSchema),
    { querystring: IncludeArchivedQuerySchema },
  ),
  "POST /admin/consumption-points": route(
    "createConsumptionPoint",
    "Consumption settings",
    "Cria um ponto de consumo no hotel ativo.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: ConsumptionPointBodySchema,
      response: { 201: itemSchema(ConsumptionPointSchema), ...adminErrors },
    },
  ),
  "PUT /admin/consumption-points/order": admin(
    "reorderConsumptionPoints",
    "Consumption settings",
    "Reordena atomicamente todos os pontos não arquivados.",
    OkSchema,
    { body: ConsumptionReorderBodySchema },
  ),
  "PUT /admin/consumption-points/:id": admin(
    "updateConsumptionPoint",
    "Consumption settings",
    "Atualiza um ponto e sua política padrão.",
    itemSchema(ConsumptionPointSchema),
    { params: IdParamsSchema, body: ConsumptionPointUpdateSchema },
  ),
  "POST /admin/consumption-points/:id/archive": admin(
    "archiveConsumptionPoint",
    "Consumption settings",
    "Arquiva um ponto sem alterar suas ofertas.",
    itemSchema(ConsumptionPointSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/consumption-points/:id/restore": admin(
    "restoreConsumptionPoint",
    "Consumption settings",
    "Restaura um ponto e preserva os estados de suas ofertas.",
    itemSchema(ConsumptionPointSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/consumption-points/:id/history": admin(
    "listConsumptionPointHistory",
    "Consumption settings",
    "Lista o histórico imutável de um ponto.",
    listSchema(ConsumptionConfigurationAuditEventSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/consumption-offers": admin(
    "listConsumptionOffers",
    "Consumption settings",
    "Lista ofertas e suas políticas e disponibilidades resolvidas.",
    listSchema(ConsumptionOfferSchema),
    {
      querystring: Type.Object(
        {
          include_archived: Type.Optional(Type.Boolean()),
          point_id: Type.Optional(uuid()),
          product_id: Type.Optional(uuid()),
        },
        strict,
      ),
    },
  ),
  "POST /admin/consumption-points/:id/offers": route(
    "createConsumptionOffers",
    "Consumption settings",
    "Vincula atomicamente um ou mais produtos ao ponto.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      params: IdParamsSchema,
      body: ConsumptionOfferBatchBodySchema,
      response: { 201: listSchema(ConsumptionOfferSchema), ...adminErrors },
    },
  ),
  "PUT /admin/consumption-points/:id/offers/order": admin(
    "reorderConsumptionOffers",
    "Consumption settings",
    "Reordena atomicamente as ofertas não arquivadas do ponto.",
    OkSchema,
    { params: IdParamsSchema, body: ConsumptionReorderBodySchema },
  ),
  "PUT /admin/consumption-offers/:id": admin(
    "updateConsumptionOffer",
    "Consumption settings",
    "Atualiza estado, ordem ou política de uma oferta.",
    itemSchema(ConsumptionOfferSchema),
    { params: IdParamsSchema, body: ConsumptionOfferUpdateSchema },
  ),
  "POST /admin/consumption-offers/:id/archive": admin(
    "archiveConsumptionOffer",
    "Consumption settings",
    "Arquiva uma oferta preservando sua configuração.",
    itemSchema(ConsumptionOfferSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/consumption-offers/:id/restore": admin(
    "restoreConsumptionOffer",
    "Consumption settings",
    "Restaura uma oferta previamente arquivada.",
    itemSchema(ConsumptionOfferSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/consumption-offers/:id/history": admin(
    "listConsumptionOfferHistory",
    "Consumption settings",
    "Lista o histórico imutável de uma oferta.",
    listSchema(ConsumptionConfigurationAuditEventSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/consumption-orders/eligible-stays": admin(
    "listConsumptionEligibleStays",
    "Consumption operations",
    "Localiza até vinte estadias em check-in por quarto, reserva ou hóspede.",
    listSchema(ConsumptionEligibleStaySchema),
    {
      querystring: Type.Object(
        { search: Type.Optional(Type.String({ maxLength: 120 })) },
        strict,
      ),
    },
  ),
  "GET /admin/consumption-orders/context": admin(
    "getConsumptionOperationalContext",
    "Consumption operations",
    "Resolve hóspedes, ofertas, preços, políticas e versões da comanda.",
    itemSchema(ConsumptionOperationalContextSchema),
    {
      querystring: Type.Object(
        { stay_id: uuid(), occurred_at: Type.Optional(dateTime()) },
        strict,
      ),
    },
  ),
  "POST /admin/consumption-orders": route(
    "postConsumptionOrder",
    "Consumption operations",
    "Valida e lança uma comanda de consumo atomicamente.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: ConsumptionOrderBodySchema,
      response: {
        200: itemSchema(ConsumptionOrderSchema),
        201: itemSchema(ConsumptionOrderSchema),
        ...adminErrors,
      },
    },
  ),
  "GET /admin/consumption-orders": admin(
    "listConsumptionOrders",
    "Consumption operations",
    "Lista o histórico paginado e filtrável de comandas.",
    ConsumptionOrderHistorySchema,
    {
      querystring: Type.Object(
        {
          cursor: Type.Optional(dateTime()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
          from: Type.Optional(dateTime()),
          to: Type.Optional(dateTime()),
          search: Type.Optional(Type.String({ maxLength: 120 })),
          point_id: Type.Optional(uuid()),
          billing_mode: Type.Optional(ConsumptionBillingModeSchema),
          disposition: Type.Optional(ConsumptionOrderDispositionSchema),
          provider_type: Type.Optional(ProductProviderSchema),
          operator_id: Type.Optional(uuid()),
        },
        strict,
      ),
    },
  ),
  "GET /admin/consumption-orders/:id": admin(
    "getConsumptionOrder",
    "Consumption operations",
    "Consulta a ficha, recibo, eventos e vínculos financeiros da comanda.",
    itemSchema(ConsumptionOrderSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/consumption-orders/:id/corrections": admin(
    "requestConsumptionCorrection",
    "Stay accounts",
    "Solicita um ajuste redutor ou anula uma comanda elegível.",
    itemSchema(ConsumptionCorrectionSchema),
    { params: IdParamsSchema, body: ConsumptionCorrectionBodySchema },
  ),
  "GET /admin/consumption-corrections": admin(
    "listConsumptionCorrections",
    "Stay accounts",
    "Lista a fila gerencial de correções de consumo.",
    listSchema(ConsumptionCorrectionSchema),
    {
      querystring: Type.Object(
        {
          status: Type.Optional(ConsumptionCorrectionStatusSchema),
          stay_id: Type.Optional(uuid()),
        },
        strict,
      ),
    },
  ),
  "POST /admin/consumption-corrections/:id/decision": admin(
    "decideConsumptionCorrection",
    "Stay accounts",
    "Aprova ou rejeita uma correção solicitada por outro usuário.",
    itemSchema(ConsumptionCorrectionSchema),
    {
      params: IdParamsSchema,
      body: ConsumptionCorrectionDecisionBodySchema,
    },
  ),
  "POST /admin/consumption-corrections/:id/refund": admin(
    "refundConsumptionCorrection",
    "Stay accounts",
    "Registra o reembolso do hotel necessário para concluir uma correção.",
    itemSchema(ConsumptionCorrectionSchema),
    { params: IdParamsSchema, body: StayRefundBodySchema },
  ),
  "POST /admin/consumption-corrections/:id/partner-refund-confirmation": admin(
    "confirmPartnerCorrectionRefund",
    "Stay accounts",
    "Confirma o reembolso externo efetuado pelo parceiro.",
    itemSchema(ConsumptionCorrectionSchema),
    { params: IdParamsSchema, body: PartnerRefundConfirmationBodySchema },
  ),
  "GET /admin/inventory/overview": admin(
    "getInventoryOverview",
    "Inventory",
    "Lista posições, alertas e sugestões de reposição do hotel ativo.",
    Type.Object(
      {
        settings: InventorySettingsSchema,
        items: Type.Array(InventoryPositionSchema),
      },
      strict,
    ),
    {
      querystring: Type.Object(
        {
          location_id: Type.Optional(uuid()),
          product_id: Type.Optional(uuid()),
          low_only: Type.Optional(Type.Boolean()),
        },
        strict,
      ),
    },
  ),
  "GET /admin/inventory/settings": admin(
    "getInventorySettings",
    "Inventory",
    "Consulta a política de saldo insuficiente.",
    itemSchema(InventorySettingsSchema),
  ),
  "PUT /admin/inventory/settings": admin(
    "updateInventorySettings",
    "Inventory",
    "Atualiza a política de saldo insuficiente.",
    itemSchema(InventorySettingsSchema),
    { body: InventorySettingsBodySchema },
  ),
  "GET /admin/inventory/locations": admin(
    "listInventoryLocations",
    "Inventory",
    "Lista locais de estoque.",
    listSchema(InventoryLocationSchema),
    { querystring: IncludeArchivedQuerySchema },
  ),
  "PUT /admin/inventory/locations/order": admin(
    "reorderInventoryLocations",
    "Inventory",
    "Reordena atomicamente todos os locais não arquivados.",
    OkSchema,
    {
      body: Type.Object(
        { ids: Type.Array(uuid(), { minItems: 1, uniqueItems: true }) },
        strict,
      ),
    },
  ),
  "POST /admin/inventory/locations": route(
    "createInventoryLocation",
    "Inventory",
    "Cria um local de estoque.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: InventoryLocationBodySchema,
      response: { 201: itemSchema(InventoryLocationSchema), ...adminErrors },
    },
  ),
  "PUT /admin/inventory/locations/:id": admin(
    "updateInventoryLocation",
    "Inventory",
    "Atualiza um local de estoque.",
    itemSchema(InventoryLocationSchema),
    { params: IdParamsSchema, body: InventoryLocationUpdateSchema },
  ),
  "POST /admin/inventory/locations/:id/archive": admin(
    "archiveInventoryLocation",
    "Inventory",
    "Arquiva um local vazio e sem vínculos ativos.",
    itemSchema(InventoryLocationSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/inventory/locations/:id/restore": admin(
    "restoreInventoryLocation",
    "Inventory",
    "Restaura um local de estoque.",
    itemSchema(InventoryLocationSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/inventory/positions": route(
    "createInventoryPosition",
    "Inventory",
    "Ativa controle de um produto em um local.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: InventoryPositionBodySchema,
      response: { 201: itemSchema(InventoryPositionSchema), ...adminErrors },
    },
  ),
  "PUT /admin/inventory/positions/:id": admin(
    "updateInventoryPosition",
    "Inventory",
    "Atualiza mínimos, ideal e estado de uma posição.",
    itemSchema(InventoryPositionSchema),
    { params: IdParamsSchema, body: InventoryPositionUpdateSchema },
  ),
  "GET /admin/inventory/movements": admin(
    "listInventoryMovements",
    "Inventory",
    "Consulta o razão imutável de estoque.",
    Type.Object(
      {
        items: Type.Array(InventoryMovementSchema),
        next_cursor: nullable(Type.String()),
      },
      strict,
    ),
    {
      querystring: Type.Object(
        {
          cursor: Type.Optional(dateTime()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
          location_id: Type.Optional(uuid()),
          product_id: Type.Optional(uuid()),
          kind: Type.Optional(InventoryMovementKindSchema),
        },
        strict,
      ),
    },
  ),
  "GET /admin/inventory/audit": admin(
    "listInventoryAuditEvents",
    "Inventory",
    "Consulta a auditoria imutável de configurações e documentos de estoque.",
    Type.Object(
      {
        items: Type.Array(InventoryAuditEventSchema),
        next_cursor: nullable(Type.String()),
      },
      strict,
    ),
    {
      querystring: Type.Object(
        {
          cursor: Type.Optional(dateTime()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        },
        strict,
      ),
    },
  ),
  "POST /admin/inventory/documents": route(
    "postInventoryDocument",
    "Inventory",
    "Registra entrada, ajuste, perda ou uso interno atomicamente.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: InventoryDocumentBodySchema,
      response: {
        201: itemSchema(Type.Object({ id: uuid() }, strict)),
        200: itemSchema(Type.Object({ id: uuid() }, strict)),
        ...adminErrors,
      },
    },
  ),
  "POST /admin/inventory/transfers": route(
    "transferInventory",
    "Inventory",
    "Transfere saldo entre locais atomicamente.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: InventoryTransferBodySchema,
      response: {
        201: itemSchema(Type.Object({ id: uuid() }, strict)),
        200: itemSchema(Type.Object({ id: uuid() }, strict)),
        ...adminErrors,
      },
    },
  ),
  "GET /admin/inventory/counts": admin(
    "listInventoryCounts",
    "Inventory",
    "Lista sessões de contagem.",
    listSchema(InventoryCountSchema),
  ),
  "POST /admin/inventory/counts": route(
    "createInventoryCount",
    "Inventory",
    "Abre uma sessão de contagem.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: InventoryCountBodySchema,
      response: {
        201: itemSchema(InventoryCountSchema),
        200: itemSchema(InventoryCountSchema),
        ...adminErrors,
      },
    },
  ),
  "PUT /admin/inventory/counts/:id/items": admin(
    "updateInventoryCount",
    "Inventory",
    "Registra quantidades contadas.",
    itemSchema(InventoryCountSchema),
    { params: IdParamsSchema, body: InventoryCountItemsBodySchema },
  ),
  "POST /admin/inventory/counts/:id/complete": admin(
    "completeInventoryCount",
    "Inventory",
    "Conclui a contagem e gera divergências.",
    itemSchema(InventoryCountSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/inventory/counts/:id/cancel": admin(
    "cancelInventoryCount",
    "Inventory",
    "Cancela uma contagem em rascunho.",
    itemSchema(InventoryCountSchema),
    { params: IdParamsSchema },
  ),
  ...crud(
    "Season",
    "Seasons",
    "/admin/seasons",
    SeasonSchema,
    SeasonBodySchema,
    SeasonUpdateSchema,
  ),
  ...crud(
    "SeasonRoomRate",
    "Season room rates",
    "/admin/season-room-rates",
    SeasonRoomRateSchema,
    SeasonRoomRateBodySchema,
    SeasonRoomRateUpdateSchema,
  ),
  ...crud(
    "FinancialTransaction",
    "Financial transactions",
    "/admin/financial-transactions",
    FinancialTransactionSchema,
    FinancialTransactionBodySchema,
    FinancialTransactionUpdateSchema,
  ),
  "GET /admin/maintenance/summary": admin(
    "getMaintenanceSummary",
    "Maintenance",
    "Retorna contadores operacionais de manutenção.",
    MaintenanceSummarySchema,
  ),
  "GET /admin/maintenance/reference-data": admin(
    "getMaintenanceReferenceData",
    "Maintenance",
    "Retorna catálogos e referências do hotel ativo.",
    MaintenanceReferenceDataSchema,
  ),
  "GET /admin/maintenance/categories": admin(
    "listMaintenanceCategories",
    "Maintenance",
    "Lista categorias de manutenção.",
    listSchema(MaintenanceCategorySchema),
  ),
  "POST /admin/maintenance/categories": route(
    "createMaintenanceCategory",
    "Maintenance",
    "Cria uma categoria de manutenção.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: MaintenanceCatalogBodySchema,
      response: { 201: itemSchema(MaintenanceCategorySchema), ...adminErrors },
    },
  ),
  "PUT /admin/maintenance/categories/:id": admin(
    "updateMaintenanceCategory",
    "Maintenance",
    "Atualiza uma categoria de manutenção.",
    itemSchema(MaintenanceCategorySchema),
    { params: IdParamsSchema, body: MaintenanceCatalogBodySchema },
  ),
  "GET /admin/maintenance/locations": admin(
    "listMaintenanceLocations",
    "Maintenance",
    "Lista áreas e equipamentos de manutenção.",
    listSchema(MaintenanceLocationSchema),
  ),
  "POST /admin/maintenance/locations": route(
    "createMaintenanceLocation",
    "Maintenance",
    "Cria uma área ou equipamento.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: MaintenanceCatalogBodySchema,
      response: { 201: itemSchema(MaintenanceLocationSchema), ...adminErrors },
    },
  ),
  "PUT /admin/maintenance/locations/:id": admin(
    "updateMaintenanceLocation",
    "Maintenance",
    "Atualiza uma área ou equipamento.",
    itemSchema(MaintenanceLocationSchema),
    { params: IdParamsSchema, body: MaintenanceCatalogBodySchema },
  ),
  "GET /admin/maintenance/occurrences": admin(
    "listMaintenanceOccurrences",
    "Maintenance",
    "Lista ocorrências de manutenção.",
    MaintenanceOccurrenceListSchema,
    {
      querystring: Type.Object(
        {
          page: Type.Optional(Type.String()),
          page_size: Type.Optional(Type.String()),
          status: Type.Optional(Type.String()),
          priority: Type.Optional(Type.String()),
          category_id: Type.Optional(Type.String()),
          room_id: Type.Optional(Type.String()),
          location_id: Type.Optional(Type.String()),
          assigned_to: Type.Optional(Type.String()),
          overdue: Type.Optional(Type.String()),
          blocked: Type.Optional(Type.String()),
          search: Type.Optional(Type.String()),
        },
        strict,
      ),
    },
  ),
  "POST /admin/maintenance/occurrences": route(
    "createMaintenanceOccurrence",
    "Maintenance",
    "Registra uma ocorrência de manutenção.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: MaintenanceOccurrenceBodySchema,
      response: {
        201: itemSchema(MaintenanceOccurrenceDetailSchema),
        ...adminErrors,
      },
    },
  ),
  "GET /admin/maintenance/occurrences/:id": admin(
    "getMaintenanceOccurrence",
    "Maintenance",
    "Retorna o detalhe de uma ocorrência.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/maintenance/occurrences/:id/triage": admin(
    "triageMaintenanceOccurrence",
    "Maintenance",
    "Realiza a triagem de uma ocorrência.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    { params: IdParamsSchema, body: MaintenanceTriageBodySchema },
  ),
  "POST /admin/maintenance/occurrences/:id/comments": admin(
    "commentMaintenanceOccurrence",
    "Maintenance",
    "Adiciona comentário à ocorrência.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "POST /admin/maintenance/occurrences/:id/cancel": admin(
    "cancelMaintenanceOccurrence",
    "Maintenance",
    "Cancela uma ocorrência preservando histórico.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "POST /admin/maintenance/occurrences/:id/duplicate": admin(
    "markMaintenanceOccurrenceDuplicate",
    "Maintenance",
    "Marca a ocorrência como duplicada e preserva o vínculo com o registro canônico.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    { params: IdParamsSchema, body: MaintenanceDuplicateBodySchema },
  ),
  "POST /admin/maintenance/occurrences/:id/reopen": admin(
    "reopenMaintenanceOccurrence",
    "Maintenance",
    "Reabre uma ocorrência concluída ou cancelada.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "POST /admin/maintenance/occurrences/:id/liability/suspect": admin(
    "suspectMaintenanceLiability",
    "Maintenance",
    "Registra suspeita de responsabilidade.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    {
      params: IdParamsSchema,
      body: Type.Object(
        {
          party: MaintenanceResponsiblePartySchema,
          notes: Type.String({ minLength: 3, maxLength: 2000 }),
        },
        strict,
      ),
    },
  ),
  "POST /admin/maintenance/occurrences/:id/liability/decide": admin(
    "decideMaintenanceLiability",
    "Maintenance",
    "Confirma ou descarta responsabilidade.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    { params: IdParamsSchema, body: MaintenanceLiabilityBodySchema },
  ),
  "POST /admin/maintenance/occurrences/:id/work-orders": route(
    "createMaintenanceWorkOrder",
    "Maintenance",
    "Cria uma ordem de trabalho.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      params: IdParamsSchema,
      body: MaintenanceWorkOrderBodySchema,
      response: {
        201: itemSchema(MaintenanceOccurrenceDetailSchema),
        ...adminErrors,
      },
    },
  ),
  "POST /admin/maintenance/work-orders/:id/transition": admin(
    "transitionMaintenanceWorkOrder",
    "Maintenance",
    "Executa uma transição de ordem de trabalho.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    { params: IdParamsSchema, body: MaintenanceTransitionBodySchema },
  ),
  "POST /admin/maintenance/work-orders/:id/inspect": admin(
    "inspectMaintenanceWorkOrder",
    "Maintenance",
    "Inspeciona uma ordem concluída.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    { params: IdParamsSchema, body: MaintenanceInspectionBodySchema },
  ),
  "POST /admin/maintenance/occurrences/:id/room-blocks": route(
    "createMaintenanceRoomBlock",
    "Maintenance",
    "Bloqueia o quarto da ocorrência.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      params: IdParamsSchema,
      body: MaintenanceBlockBodySchema,
      response: {
        201: itemSchema(MaintenanceOccurrenceDetailSchema),
        ...adminErrors,
      },
    },
  ),
  "POST /admin/maintenance/room-blocks/:id/release": admin(
    "releaseMaintenanceRoomBlock",
    "Maintenance",
    "Libera um bloqueio após os requisitos operacionais.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "POST /admin/maintenance/occurrences/:id/attachments/upload-intents": admin(
    "createMaintenanceAttachmentUploadIntents",
    "Maintenance",
    "Gera autorizações temporárias para fotos.",
    MaintenanceUploadIntentSchema,
    { params: IdParamsSchema, body: MaintenanceAttachmentIntentBodySchema },
  ),
  "POST /admin/maintenance/occurrences/:id/attachments/finalize": admin(
    "finalizeMaintenanceAttachments",
    "Maintenance",
    "Confirma fotos enviadas.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    { params: IdParamsSchema, body: MaintenanceAttachmentFinalizeBodySchema },
  ),
  "POST /admin/maintenance/attachments/:id/access": admin(
    "accessMaintenanceAttachment",
    "Maintenance",
    "Gera acesso temporário a uma foto.",
    MaintenanceAttachmentAccessSchema,
    { params: IdParamsSchema },
  ),
  "POST /admin/maintenance/attachments/:id/remove": admin(
    "removeMaintenanceAttachment",
    "Maintenance",
    "Remove uma foto com justificativa auditada.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "GET /admin/maintenance/preventive-plans": admin(
    "listMaintenancePreventivePlans",
    "Maintenance management",
    "Lista planos preventivos.",
    listSchema(MaintenancePreventivePlanSchema),
  ),
  "POST /admin/maintenance/preventive-plans": route(
    "createMaintenancePreventivePlan",
    "Maintenance management",
    "Cria um plano preventivo.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: MaintenancePreventivePlanBodySchema,
      response: {
        201: itemSchema(MaintenancePreventivePlanSchema),
        ...adminErrors,
      },
    },
  ),
  "GET /admin/maintenance/preventive-plans/:id": admin(
    "getMaintenancePreventivePlan",
    "Maintenance management",
    "Retorna um plano preventivo.",
    itemSchema(MaintenancePreventivePlanSchema),
    { params: IdParamsSchema },
  ),
  "PUT /admin/maintenance/preventive-plans/:id": admin(
    "updateMaintenancePreventivePlan",
    "Maintenance management",
    "Atualiza somente competências futuras do plano.",
    itemSchema(MaintenancePreventivePlanSchema),
    { params: IdParamsSchema, body: MaintenancePreventivePlanBodySchema },
  ),
  "POST /admin/maintenance/preventive-plans/:id/pause": admin(
    "pauseMaintenancePreventivePlan",
    "Maintenance management",
    "Pausa novas competências preventivas.",
    itemSchema(MaintenancePreventivePlanSchema),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "POST /admin/maintenance/preventive-plans/:id/resume": admin(
    "resumeMaintenancePreventivePlan",
    "Maintenance management",
    "Retoma novas competências preventivas.",
    itemSchema(MaintenancePreventivePlanSchema),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "POST /admin/maintenance/preventive-plans/:id/deactivate": admin(
    "deactivateMaintenancePreventivePlan",
    "Maintenance management",
    "Desativa definitivamente novas competências preventivas.",
    itemSchema(MaintenancePreventivePlanSchema),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "GET /admin/maintenance/preventive-plans/:id/runs": admin(
    "listMaintenancePreventiveRuns",
    "Maintenance management",
    "Lista competências de um plano.",
    listSchema(MaintenancePreventiveRunSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/maintenance/preventive-runs/:id/generate": admin(
    "generateMaintenancePreventiveRun",
    "Maintenance management",
    "Gera uma competência adiada com justificativa.",
    itemSchema(MaintenancePreventiveRunSchema),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "POST /admin/maintenance/preventive-runs/:id/skip": admin(
    "skipMaintenancePreventiveRun",
    "Maintenance management",
    "Ignora uma competência adiada com justificativa.",
    itemSchema(MaintenancePreventiveRunSchema),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "POST /admin/maintenance/preventive-runs/:id/reschedule": admin(
    "rescheduleMaintenancePreventiveRun",
    "Maintenance management",
    "Reagenda uma competência adiada.",
    itemSchema(MaintenancePreventiveRunSchema),
    {
      params: IdParamsSchema,
      body: Type.Object(
        {
          reason: Type.String({ minLength: 3, maxLength: 2000 }),
          scheduled_for: date(),
        },
        strict,
      ),
    },
  ),
  "POST /admin/maintenance/work-orders/:id/checklist/:itemId/complete": admin(
    "completeMaintenanceChecklist",
    "Maintenance management",
    "Conclui ou reabre um item do checklist.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    {
      params: Type.Object({ id: uuid(), itemId: uuid() }, strict),
      body: Type.Object(
        {
          completed: Type.Boolean(),
          notes: Type.Optional(Type.String({ maxLength: 2000 })),
        },
        strict,
      ),
    },
  ),
  "POST /admin/maintenance/work-orders/:id/supplier-transition": admin(
    "transitionMaintenanceSupplierWork",
    "Maintenance management",
    "Registra o andamento do fornecedor sem concluir a ordem interna.",
    itemSchema(MaintenanceOccurrenceDetailSchema),
    {
      params: IdParamsSchema,
      body: Type.Object(
        {
          action: Type.Union([
            Type.Literal("send"),
            Type.Literal("accept"),
            Type.Literal("start"),
            Type.Literal("complete"),
            Type.Literal("cancel"),
          ]),
          supplier_id: optionalNullable(uuid()),
          contract_id: optionalNullable(uuid()),
          external_reference: Type.Optional(Type.String({ maxLength: 240 })),
          notes: Type.Optional(Type.String({ maxLength: 2000 })),
        },
        strict,
      ),
    },
  ),
  "GET /admin/maintenance/sla-policies": admin(
    "listMaintenanceSlaPolicies",
    "Maintenance management",
    "Lista políticas de SLA e sua precedência.",
    listSchema(MaintenanceSlaPolicySchema),
  ),
  "POST /admin/maintenance/sla-policies": route(
    "createMaintenanceSlaPolicy",
    "Maintenance management",
    "Cria uma política de SLA.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: Type.Object(
        {
          category_id: optionalNullable(uuid()),
          priority: MaintenancePrioritySchema,
          name: Type.String({ minLength: 2, maxLength: 120 }),
          response_hours: Type.Integer({ minimum: 1 }),
          resolution_hours: Type.Integer({ minimum: 1 }),
        },
        strict,
      ),
      response: { 201: itemSchema(MaintenanceSlaPolicySchema), ...adminErrors },
    },
  ),
  "PUT /admin/maintenance/sla-policies/:id": admin(
    "updateMaintenanceSlaPolicy",
    "Maintenance management",
    "Atualiza ou desativa uma política de SLA para ocorrências futuras.",
    itemSchema(MaintenanceSlaPolicySchema),
    {
      params: IdParamsSchema,
      body: Type.Object(
        {
          name: Type.Optional(Type.String({ minLength: 2, maxLength: 120 })),
          response_hours: Type.Optional(Type.Integer({ minimum: 1 })),
          resolution_hours: Type.Optional(Type.Integer({ minimum: 1 })),
          is_active: Type.Optional(Type.Boolean()),
        },
        strict,
      ),
    },
  ),
  "GET /admin/maintenance/suppliers": admin(
    "listMaintenanceSuppliers",
    "Maintenance management",
    "Lista fornecedores do hotel.",
    listSchema(MaintenanceSupplierSchema),
  ),
  "POST /admin/maintenance/suppliers": route(
    "createMaintenanceSupplier",
    "Maintenance management",
    "Cadastra fornecedor.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: Type.Object(
        {
          name: Type.String({ minLength: 2, maxLength: 160 }),
          legal_name: optionalNullable(Type.String()),
          tax_document: optionalNullable(Type.String()),
          email: optionalNullable(Type.String()),
          phone: optionalNullable(Type.String()),
          specialties: Type.Optional(Type.Array(Type.String())),
          notes: optionalNullable(Type.String()),
        },
        strict,
      ),
      response: { 201: itemSchema(MaintenanceSupplierSchema), ...adminErrors },
    },
  ),
  "PUT /admin/maintenance/suppliers/:id": admin(
    "updateMaintenanceSupplier",
    "Maintenance management",
    "Atualiza ou desativa fornecedor preservando histórico.",
    itemSchema(MaintenanceSupplierSchema),
    {
      params: IdParamsSchema,
      body: Type.Partial(
        Type.Object(
          {
            name: Type.String({ minLength: 2, maxLength: 160 }),
            legal_name: nullable(Type.String()),
            tax_document: nullable(Type.String()),
            email: nullable(Type.String()),
            phone: nullable(Type.String()),
            specialties: Type.Array(Type.String()),
            notes: nullable(Type.String()),
            status: Type.Union([
              Type.Literal("active"),
              Type.Literal("inactive"),
            ]),
          },
          strict,
        ),
      ),
    },
  ),
  "POST /admin/maintenance/suppliers/:id/contacts": route(
    "createMaintenanceSupplierContact",
    "Maintenance management",
    "Cadastra contato do fornecedor.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      params: IdParamsSchema,
      body: Type.Object(
        {
          name: Type.String({ minLength: 2 }),
          role: optionalNullable(Type.String()),
          email: optionalNullable(Type.String()),
          phone: optionalNullable(Type.String()),
          is_primary: Type.Optional(Type.Boolean()),
        },
        strict,
      ),
      response: {
        201: itemSchema(MaintenanceSupplierContactSchema),
        ...adminErrors,
      },
    },
  ),
  "PUT /admin/maintenance/supplier-contacts/:id": admin(
    "updateMaintenanceSupplierContact",
    "Maintenance management",
    "Atualiza ou desativa contato preservando histórico.",
    itemSchema(MaintenanceSupplierContactSchema),
    {
      params: IdParamsSchema,
      body: Type.Partial(
        Type.Object(
          {
            name: Type.String({ minLength: 2 }),
            role: nullable(Type.String()),
            email: nullable(Type.String()),
            phone: nullable(Type.String()),
            is_primary: Type.Boolean(),
            is_active: Type.Boolean(),
          },
          strict,
        ),
      ),
    },
  ),
  "POST /admin/maintenance/suppliers/:id/contracts": route(
    "createMaintenanceContract",
    "Maintenance management",
    "Cadastra contrato do fornecedor sem gerar obrigação financeira.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      params: IdParamsSchema,
      body: Type.Object(
        {
          contract_number: Type.String({ minLength: 1 }),
          kind: Type.Union([
            Type.Literal("fixed"),
            Type.Literal("per_service"),
            Type.Literal("warranty"),
            Type.Literal("other"),
          ]),
          status: Type.Optional(
            Type.Union([Type.Literal("draft"), Type.Literal("active")]),
          ),
          starts_on: date(),
          ends_on: optionalNullable(date()),
          renewal_notice_on: optionalNullable(date()),
          scope_notes: optionalNullable(Type.String()),
          response_hours: optionalNullable(Type.Integer({ minimum: 1 })),
          resolution_hours: optionalNullable(Type.Integer({ minimum: 1 })),
          commercial_terms: optionalNullable(Type.String()),
          contract_amount: optionalNullable(Type.Number({ minimum: 0 })),
          currency: optionalNullable(Type.String({ pattern: "^[A-Z]{3}$" })),
          category_ids: Type.Optional(Type.Array(uuid())),
          location_ids: Type.Optional(Type.Array(uuid())),
        },
        strict,
      ),
      response: { 201: itemSchema(MaintenanceContractSchema), ...adminErrors },
    },
  ),
  "PUT /admin/maintenance/contracts/:id": admin(
    "updateMaintenanceContract",
    "Maintenance management",
    "Atualiza ou encerra contrato com auditoria.",
    itemSchema(MaintenanceContractSchema),
    {
      params: IdParamsSchema,
      body: Type.Partial(
        Type.Object(
          {
            status: Type.Union([
              Type.Literal("draft"),
              Type.Literal("active"),
              Type.Literal("expired"),
              Type.Literal("terminated"),
            ]),
            ends_on: nullable(date()),
            renewal_notice_on: nullable(date()),
            scope_notes: nullable(Type.String()),
            commercial_terms: nullable(Type.String()),
            category_ids: Type.Array(uuid()),
            location_ids: Type.Array(uuid()),
            termination_reason: Type.String({ minLength: 3 }),
          },
          strict,
        ),
      ),
    },
  ),
  "POST /admin/maintenance/management-documents/upload-intents": admin(
    "createMaintenanceManagementDocumentIntents",
    "Maintenance management",
    "Gera URLs temporárias para documentos de fornecedor ou contrato.",
    MaintenanceUploadIntentSchema,
    {
      body: Type.Object(
        {
          target_type: Type.Union([
            Type.Literal("supplier"),
            Type.Literal("contract"),
          ]),
          target_id: uuid(),
          files: Type.Array(
            Type.Object(
              {
                filename: Type.String(),
                content_type: Type.Union([
                  Type.Literal("image/jpeg"),
                  Type.Literal("image/png"),
                  Type.Literal("image/webp"),
                  Type.Literal("application/pdf"),
                ]),
                size_bytes: Type.Integer({ minimum: 1, maximum: 10485760 }),
              },
              strict,
            ),
            { minItems: 1, maxItems: 5 },
          ),
        },
        strict,
      ),
    },
  ),
  "POST /admin/maintenance/management-documents/finalize": admin(
    "finalizeMaintenanceManagementDocuments",
    "Maintenance management",
    "Confirma documentos gerenciais enviados.",
    Type.Object({ ok: Type.Boolean() }, strict),
    {
      body: Type.Object(
        {
          target_type: Type.Union([
            Type.Literal("supplier"),
            Type.Literal("contract"),
          ]),
          target_id: uuid(),
          files: Type.Array(
            Type.Object(
              {
                storage_path: Type.String(),
                filename: Type.String(),
                content_type: Type.String(),
                size_bytes: Type.Integer(),
              },
              strict,
            ),
            { minItems: 1, maxItems: 5 },
          ),
        },
        strict,
      ),
    },
  ),
  "POST /admin/maintenance/management-documents/:id/access": admin(
    "accessMaintenanceManagementDocument",
    "Maintenance management",
    "Gera acesso temporário a documento gerencial.",
    MaintenanceAttachmentAccessSchema,
    { params: IdParamsSchema },
  ),
  "POST /admin/maintenance/management-documents/:id/remove": admin(
    "removeMaintenanceManagementDocument",
    "Maintenance management",
    "Remove documento gerencial com justificativa auditada.",
    Type.Object({ ok: Type.Boolean() }, strict),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "GET /admin/maintenance/notifications": admin(
    "listMaintenanceNotifications",
    "Maintenance management",
    "Lista notificações do usuário atual.",
    listSchema(MaintenanceNotificationSchema),
    {
      querystring: Type.Object(
        {
          status: Type.Optional(Type.String()),
          kind: Type.Optional(Type.String()),
        },
        strict,
      ),
    },
  ),
  "GET /admin/maintenance/notifications/summary": admin(
    "getMaintenanceNotificationSummary",
    "Maintenance management",
    "Retorna contagem de notificações não lidas.",
    Type.Object({ unread: Type.Integer() }, strict),
  ),
  "POST /admin/maintenance/notifications/:id/status": admin(
    "setMaintenanceNotificationStatus",
    "Maintenance management",
    "Marca notificação como lida, não lida ou dispensada.",
    Type.Object({ ok: Type.Boolean() }, strict),
    {
      params: IdParamsSchema,
      body: Type.Object(
        {
          status: Type.Union([
            Type.Literal("unread"),
            Type.Literal("read"),
            Type.Literal("dismissed"),
          ]),
        },
        strict,
      ),
    },
  ),
  "POST /admin/maintenance/notifications/read-all": admin(
    "readAllMaintenanceNotifications",
    "Maintenance management",
    "Marca todas as notificações como lidas.",
    Type.Object({ updated: Type.Integer() }, strict),
  ),
  "GET /admin/maintenance/analytics": admin(
    "getMaintenanceAnalytics",
    "Maintenance management",
    "Retorna indicadores gerenciais com redação financeira por permissão.",
    MaintenanceAnalyticsSchema,
    { querystring: MaintenanceAnalyticsFilterSchema },
  ),
  "GET /admin/maintenance/analytics/export-data": admin(
    "exportMaintenanceAnalytics",
    "Maintenance management",
    "Exporta o recorte gerencial em CSV ou PDF.",
    Type.Any(),
    { querystring: MaintenanceAnalyticsFilterSchema },
  ),
  "GET /admin/maintenance/automation-runs": admin(
    "listMaintenanceAutomationRuns",
    "Maintenance management",
    "Lista execuções da automação.",
    listSchema(MaintenanceAutomationRunSchema),
  ),
  "POST /admin/maintenance/automation/run": admin(
    "runMaintenanceAutomation",
    "Maintenance management",
    "Reprocessa o ciclo de forma idempotente.",
    Type.Object({ result: Type.Unknown() }, strict),
    { body: Type.Object({}, strict) },
  ),
  "GET /admin/maintenance/finance/summary": admin(
    "getMaintenanceFinanceSummary",
    "Maintenance finance",
    "Retorna contadores e saldos das filas financeiras de manutenção.",
    MaintenanceFinanceSummarySchema,
  ),
  "GET /admin/maintenance/finance/items": admin(
    "listMaintenanceFinanceItems",
    "Maintenance finance",
    "Lista custos e recuperações financeiras de manutenção.",
    Type.Object(
      {
        items: Type.Array(
          Type.Union([
            Type.Ref("MaintenanceCostItem"),
            Type.Ref("MaintenanceRecovery"),
          ]),
        ),
        page: Type.Integer(),
        page_size: Type.Integer(),
        total: Type.Integer(),
      },
      strict,
    ),
    {
      querystring: Type.Object(
        {
          page: Type.Optional(Type.String()),
          page_size: Type.Optional(Type.String()),
          queue: Type.Optional(Type.String()),
          kind: Type.Optional(Type.String()),
          occurrence_id: Type.Optional(Type.String()),
        },
        strict,
      ),
    },
  ),
  "GET /admin/maintenance/occurrences/:id/finance": admin(
    "getMaintenanceOccurrenceFinance",
    "Maintenance finance",
    "Retorna custos e recuperações de uma ocorrência.",
    itemSchema(MaintenanceFinanceOccurrenceSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/maintenance/occurrences/:id/cost-items": route(
    "createMaintenanceCostItem",
    "Maintenance finance",
    "Cria um custo em rascunho.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      params: IdParamsSchema,
      body: MaintenanceCostItemBodySchema,
      response: { 201: itemSchema(MaintenanceCostItemSchema), ...adminErrors },
    },
  ),
  "PUT /admin/maintenance/cost-items/:id": admin(
    "updateMaintenanceCostItem",
    "Maintenance finance",
    "Atualiza um custo ainda editável.",
    itemSchema(MaintenanceCostItemSchema),
    { params: IdParamsSchema, body: MaintenanceCostItemBodySchema },
  ),
  "POST /admin/maintenance/cost-items/:id/transition": admin(
    "transitionMaintenanceCostItem",
    "Maintenance finance",
    "Submete, aprova, rejeita ou cancela um custo.",
    itemSchema(MaintenanceCostItemSchema),
    { params: IdParamsSchema, body: MaintenanceFinanceTransitionBodySchema },
  ),
  "POST /admin/maintenance/cost-items/:id/settlements": admin(
    "settleMaintenanceCostItem",
    "Maintenance finance",
    "Registra pagamento parcial ou integral de um custo aprovado.",
    itemSchema(MaintenanceCostItemSchema),
    { params: IdParamsSchema, body: MaintenanceFinanceSettlementBodySchema },
  ),
  "POST /admin/maintenance/occurrences/:id/recoveries": route(
    "createMaintenanceRecovery",
    "Maintenance finance",
    "Cria cobrança ou dispensa em rascunho.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      params: IdParamsSchema,
      body: MaintenanceRecoveryBodySchema,
      response: { 201: itemSchema(MaintenanceRecoverySchema), ...adminErrors },
    },
  ),
  "PUT /admin/maintenance/recoveries/:id": admin(
    "updateMaintenanceRecovery",
    "Maintenance finance",
    "Atualiza uma recuperação ainda editável.",
    itemSchema(MaintenanceRecoverySchema),
    { params: IdParamsSchema, body: MaintenanceRecoveryBodySchema },
  ),
  "POST /admin/maintenance/recoveries/:id/transition": admin(
    "transitionMaintenanceRecovery",
    "Maintenance finance",
    "Submete, aprova, rejeita ou cancela uma recuperação.",
    itemSchema(MaintenanceRecoverySchema),
    { params: IdParamsSchema, body: MaintenanceFinanceTransitionBodySchema },
  ),
  "POST /admin/maintenance/recoveries/:id/settlements": admin(
    "settleMaintenanceRecovery",
    "Maintenance finance",
    "Registra recebimento parcial ou integral.",
    itemSchema(MaintenanceRecoverySchema),
    { params: IdParamsSchema, body: MaintenanceFinanceSettlementBodySchema },
  ),
  "POST /admin/maintenance/finance/settlements/:id/reverse": admin(
    "reverseMaintenanceFinancialSettlement",
    "Maintenance finance",
    "Estorna uma liquidação com lançamentos compensatórios.",
    itemSchema(MaintenanceFinanceOccurrenceSchema),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "POST /admin/maintenance/occurrences/:id/financial-attachments/upload-intents":
    admin(
      "createMaintenanceFinancialAttachmentUploadIntents",
      "Maintenance finance",
      "Gera autorizações temporárias para documentos financeiros.",
      MaintenanceUploadIntentSchema,
      {
        params: IdParamsSchema,
        body: MaintenanceFinancialAttachmentIntentBodySchema,
      },
    ),
  "POST /admin/maintenance/occurrences/:id/financial-attachments/finalize":
    admin(
      "finalizeMaintenanceFinancialAttachments",
      "Maintenance finance",
      "Confirma documentos financeiros enviados.",
      itemSchema(MaintenanceFinanceOccurrenceSchema),
      {
        params: IdParamsSchema,
        body: MaintenanceFinancialAttachmentFinalizeBodySchema,
      },
    ),
  "POST /admin/maintenance/financial-attachments/:id/access": admin(
    "accessMaintenanceFinancialAttachment",
    "Maintenance finance",
    "Gera acesso temporário a um documento financeiro.",
    MaintenanceAttachmentAccessSchema,
    { params: IdParamsSchema },
  ),
  "POST /admin/maintenance/financial-attachments/:id/remove": admin(
    "removeMaintenanceFinancialAttachment",
    "Maintenance finance",
    "Remove documento com justificativa auditada.",
    itemSchema(MaintenanceFinanceOccurrenceSchema),
    { params: IdParamsSchema, body: MaintenanceReasonBodySchema },
  ),
  "GET /admin/reservations/calendar": admin(
    "getReservationCalendar",
    "Reservations",
    "Consulta o calendário de reservas.",
    ReservationCalendarSchema,
    {
      querystring: Type.Object(
        {
          start_date: Type.Optional(date()),
          days: Type.Optional(Type.String({ pattern: "^[0-9]+$" })),
        },
        strict,
      ),
    },
  ),
  "POST /admin/reservations/calendar/booking/simulate": admin(
    "simulateCalendarBooking",
    "Reservations",
    "Simula disponibilidade e preço de uma reserva.",
    itemSchema(CalendarBookingResponseSchema),
    { body: CalendarBookingBodySchema },
  ),
  "POST /admin/reservations/calendar/booking": route(
    "createCalendarBooking",
    "Reservations",
    "Cria uma reserva a partir do calendário.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: CalendarBookingBodySchema,
      response: {
        201: itemSchema(CalendarBookingResponseSchema),
        ...adminErrors,
      },
    },
  ),
  "GET /admin/stays/checkout-candidate": admin(
    "getCheckoutCandidate",
    "Stays",
    "Localiza uma estadia candidata a checkout.",
    itemSchema(StayPanelSchema),
    {
      querystring: Type.Object(
        { room_number: Type.Optional(Type.String()) },
        strict,
      ),
    },
  ),
  "GET /admin/stays/:id/panel": admin(
    "getStayPanel",
    "Stays",
    "Retorna o painel operacional da estadia.",
    itemSchema(StayPanelSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/stays/:id/folio": admin(
    "getStayFolio",
    "Stays",
    "Retorna o razão auditável e o saldo da estadia.",
    itemSchema(StayFolioSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/stays/:id/account": admin(
    "getStayAccount",
    "Stay accounts",
    "Retorna a conta consolidada, correções, pagamentos e fechamento da estadia.",
    itemSchema(StayAccountSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/stays/:id/payment-batches/preview": admin(
    "previewStayPaymentBatch",
    "Stay accounts",
    "Valida parcelas e mostra a alocação prevista sem movimentar a conta.",
    itemSchema(StayPaymentBatchPreviewSchema),
    { params: IdParamsSchema, body: StayPaymentBatchBodySchema },
  ),
  "POST /admin/stays/:id/payment-batches": admin(
    "createStayPaymentBatch",
    "Stay accounts",
    "Registra atomicamente um pagamento parcial ou dividido em vários meios.",
    itemSchema(StayAccountSchema),
    { params: IdParamsSchema, body: StayPaymentBatchBodySchema },
  ),
  "POST /admin/stays/:id/refunds": admin(
    "createStayRefund",
    "Stay accounts",
    "Registra um reembolso operacional e seus lançamentos compensatórios.",
    itemSchema(StayAccountSchema),
    { params: IdParamsSchema, body: StayRefundBodySchema },
  ),
  "GET /admin/stays/:id/checkout-record": admin(
    "getStayCheckoutRecord",
    "Stay accounts",
    "Consulta o snapshot imutável e o extrato não fiscal do fechamento.",
    itemSchema(StayCheckoutRecordSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/stays/:id/payments/allocation-preview": admin(
    "previewStayPaymentAllocation",
    "Stays",
    "Sugere alocação FIFO para um novo pagamento.",
    itemSchema(StayFolioAllocationPreviewSchema),
    { params: IdParamsSchema, body: StayFolioPreviewBodySchema },
  ),
  "POST /admin/stays/:id/payments": admin(
    "createStayPayment",
    "Stays",
    "Registra um pagamento da estadia.",
    itemSchema(StayPanelSchema),
    { params: IdParamsSchema, body: StayPaymentBodySchema },
  ),
  "POST /admin/stays/:id/checkin": admin(
    "checkInStay",
    "Stays",
    "Realiza o check-in da estadia.",
    itemSchema(StayPanelSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/stays/:id/checkout": admin(
    "checkOutStay",
    "Stay accounts",
    "Quita o saldo, reconhece exceções e fecha a conta atomicamente.",
    itemSchema(StayAccountSchema),
    { params: IdParamsSchema, body: StayCheckoutBodySchema },
  ),
  "POST /admin/stays/:id/no-show": admin(
    "markStayNoShow",
    "Stays",
    "Marca a estadia como no-show.",
    itemSchema(StayPanelSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/stays/:id/cancel": admin(
    "cancelStay",
    "Stays",
    "Cancela a estadia.",
    itemSchema(StayPanelSchema),
    { params: IdParamsSchema },
  ),
  "GET /admin/consumption-management/settings": admin(
    "getConsumptionManagementSettings",
    "Consumption management",
    "Consulta os parâmetros de apuração e alertas do hotel ativo.",
    itemSchema(ConsumptionManagementSettingsSchema),
  ),
  "PATCH /admin/consumption-management/settings": admin(
    "updateConsumptionManagementSettings",
    "Consumption management",
    "Atualiza parâmetros aplicáveis somente a apurações ainda abertas.",
    itemSchema(ConsumptionManagementSettingsSchema),
    { body: ConsumptionManagementSettingsBodySchema },
  ),
  "GET /admin/consumption-analytics": admin(
    "getConsumptionAnalytics",
    "Consumption management",
    "Retorna totais, série diária e agrupamento paginado do consumo.",
    itemSchema(ConsumptionAnalyticsSchema),
    {
      querystring: Type.Object(
        {
          from: date(),
          to: date(),
          dimension: Type.Optional(ConsumptionAnalyticsDimensionSchema),
          point_id: Type.Optional(uuid()),
          category_id: Type.Optional(uuid()),
          product_id: Type.Optional(uuid()),
          stay_search: Type.Optional(Type.String({ maxLength: 120 })),
          disposition: Type.Optional(ConsumptionOrderDispositionSchema),
          billing_mode: Type.Optional(ConsumptionBillingModeSchema),
          payment_method: Type.Optional(ConsumptionPaymentMethodSchema),
          provider_type: Type.Optional(ProductProviderSchema),
          partner_id: Type.Optional(uuid()),
          operator_id: Type.Optional(uuid()),
          cursor: Type.Optional(Type.String({ pattern: "^[0-9]+$" })),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        },
        strict,
      ),
    },
  ),
  "GET /admin/management-alerts": admin(
    "getManagementAlerts",
    "Consumption management",
    "Calcula alertas gerenciais respeitando as permissões do usuário.",
    itemSchema(ManagementAlertsSchema),
  ),
  "GET /admin/partner-settlements/candidates": admin(
    "listPartnerSettlementCandidates",
    "Partner settlements",
    "Lista parceiros e meses aptos à preparação de uma apuração.",
    listSchema(PartnerSettlementCandidateSchema),
    {
      querystring: Type.Object(
        {
          period_start: Type.Optional(date()),
          partner_id: Type.Optional(uuid()),
        },
        strict,
      ),
    },
  ),
  "GET /admin/partner-settlements": admin(
    "listPartnerSettlements",
    "Partner settlements",
    "Lista apurações mensais por parceiro.",
    Type.Object(
      {
        items: Type.Array(PartnerSettlementSchema),
        next_cursor: nullable(Type.String()),
      },
      strict,
    ),
    {
      querystring: Type.Object(
        {
          partner_id: Type.Optional(uuid()),
          status: Type.Optional(PartnerSettlementStatusSchema),
          period_start: Type.Optional(date()),
          cursor: Type.Optional(dateTime()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
        },
        strict,
      ),
    },
  ),
  "POST /admin/partner-settlements": route(
    "createPartnerSettlement",
    "Partner settlements",
    "Cria e calcula atomicamente a apuração mensal do parceiro.",
    {
      headers: AuthHeadersSchema,
      security: [{ bearerAuth: [] }],
      body: PartnerSettlementCreateBodySchema,
      response: { 201: itemSchema(PartnerSettlementSchema), ...adminErrors },
    },
  ),
  "GET /admin/partner-settlements/:id": admin(
    "getPartnerSettlement",
    "Partner settlements",
    "Consulta demonstrativo, fontes, pagamentos e histórico da apuração.",
    itemSchema(PartnerSettlementSchema),
    { params: IdParamsSchema },
  ),
  "POST /admin/partner-settlements/:id/recalculate": admin(
    "recalculatePartnerSettlement",
    "Partner settlements",
    "Atualiza as fontes e a memória de cálculo de uma apuração aberta.",
    itemSchema(PartnerSettlementSchema),
    { params: IdParamsSchema, body: PartnerSettlementVersionBodySchema },
  ),
  "POST /admin/partner-settlements/:id/submit": admin(
    "submitPartnerSettlement",
    "Partner settlements",
    "Envia uma apuração preparada para revisão por outra pessoa.",
    itemSchema(PartnerSettlementSchema),
    { params: IdParamsSchema, body: PartnerSettlementVersionBodySchema },
  ),
  "POST /admin/partner-settlements/:id/decision": admin(
    "decidePartnerSettlement",
    "Partner settlements",
    "Aprova ou rejeita a apuração em revisão.",
    itemSchema(PartnerSettlementSchema),
    { params: IdParamsSchema, body: PartnerSettlementDecisionBodySchema },
  ),
  "POST /admin/partner-settlements/:id/payment": admin(
    "payPartnerSettlement",
    "Partner settlements",
    "Registra a quitação integral e a transação financeira correspondente.",
    itemSchema(PartnerSettlementSchema),
    { params: IdParamsSchema, body: PartnerSettlementPaymentBodySchema },
  ),
  "POST /admin/partner-settlement-payments/:id/reversal": admin(
    "reversePartnerSettlementPayment",
    "Partner settlements",
    "Reverte uma baixa por lançamento financeiro compensatório.",
    itemSchema(PartnerSettlementSchema),
    {
      params: IdParamsSchema,
      body: PartnerSettlementPaymentReversalBodySchema,
    },
  ),
};
