import { Type, type Static, type TSchema } from "typebox";
import type {
  AdminCustomerCreateInput,
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
export const ProductBodySchema = Type.Object(
  {
    name: Type.String(),
    category: optionalNullable(Type.String()),
    unit_price: Type.Number({ minimum: 0 }),
    status: Type.Optional(ProductStatusSchema),
  },
  { ...strict, $id: "ProductCreateInput" },
);
export const ProductUpdateSchema = Type.Partial(ProductBodySchema, {
  $id: "ProductUpdateInput",
});

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
export const ProductSchema = Type.Object(
  {
    id: uuid(),
    hotel_id: uuid(),
    name: Type.String(),
    category: nullable(Type.String()),
    unit_price: Type.Number(),
    status: ProductStatusSchema,
    ...timestamps,
  },
  { ...strict, $id: "Product" },
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
const StayCheckoutBodySchema = Type.Object(
  {
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
            Type.Literal("payment"),
            Type.Literal("refund"),
            Type.Literal("adjustment"),
          ]),
          amount: Type.Number(),
          currency: Type.String(),
          description: Type.String(),
          maintenance_occurrence_id: nullable(uuid()),
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
  },
  { ...strict, $id: "StayFolio" },
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
  SeasonBodySchema,
  SeasonUpdateSchema,
  SeasonRoomRateBodySchema,
  SeasonRoomRateUpdateSchema,
  FinancialTransactionBodySchema,
  FinancialTransactionUpdateSchema,
  CalendarBookingBodySchema,
  StayPaymentBodySchema,
  StayFolioSchema,
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
  ...crud(
    "Product",
    "Products",
    "/admin/products",
    ProductSchema,
    ProductBodySchema,
    ProductUpdateSchema,
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
    "Stays",
    "Realiza o checkout da estadia.",
    itemSchema(StayPanelSchema),
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
};
