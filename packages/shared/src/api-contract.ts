import { Type, type Static, type TSchema } from "typebox";
import type {
  AdminCustomerCreateInput,
  AdminFinancialTransactionCreateInput,
  AdminHotelCreateInput,
  AdminPermissionCreateInput,
  AdminProductCreateInput,
  AdminReservationCalendarBookingCreateInput,
  AdminRoleCreateInput,
  AdminRoomCreateInput,
  AdminSeasonCreateInput,
  AdminSeasonRoomRateCreateInput,
  AdminStayPaymentCreateInput,
  AdminUserCreateInput,
  LoginRequest
} from "./index";

const strict = { additionalProperties: false } as const;
const nullable = <T extends TSchema>(schema: T) => Type.Union([schema, Type.Null()]);
const optionalNullable = <T extends TSchema>(schema: T) => Type.Optional(nullable(schema));
const uuid = () => Type.String({ format: "uuid" });
const date = () => Type.String({ format: "date" });
const dateTime = () => Type.String({ format: "date-time" });

export const ApiErrorSchema = Type.Object(
  {
    code: Type.Optional(Type.String()),
    message: Type.String(),
    details: Type.Optional(Type.String()),
    retryAfterSeconds: Type.Optional(Type.Integer({ minimum: 1 }))
  },
  { ...strict, $id: "ApiError" }
);

export const LoginBodySchema = Type.Object(
  { email: Type.String({ format: "email" }), password: Type.String({ minLength: 1 }) },
  { ...strict, $id: "LoginBody" }
);

export const HotelBodySchema = Type.Object(
  {
    name: Type.String(), legal_name: Type.String(), tax_id: Type.String(), slug: Type.String(),
    email: Type.String({ format: "email" }), phone: Type.String(), address_line: Type.String(),
    address_number: Type.String(), address_complement: nullable(Type.String()), district: Type.String(),
    city: Type.String(), state: Type.String(), country: Type.String(), zip_code: Type.String(),
    timezone: nullable(Type.String()), currency: nullable(Type.String()),
    checkin_time_start: optionalNullable(Type.String()), checkin_time_limit: optionalNullable(Type.String()),
    checkout_time_start: optionalNullable(Type.String()), checkout_time_limit: optionalNullable(Type.String())
  },
  { ...strict, $id: "HotelCreateInput" }
);
export const HotelUpdateSchema = Type.Partial(Type.Object({
  name: Type.String(), legal_name: Type.String(), tax_id: Type.String(), slug: Type.String(),
  email: nullable(Type.String({ format: "email" })), phone: nullable(Type.String()),
  address_line: nullable(Type.String()), address_number: nullable(Type.String()),
  address_complement: nullable(Type.String()), district: nullable(Type.String()), city: nullable(Type.String()),
  state: nullable(Type.String()), country: nullable(Type.String()), zip_code: nullable(Type.String()),
  timezone: nullable(Type.String()), currency: nullable(Type.String()), checkin_time_start: nullable(Type.String()),
  checkin_time_limit: nullable(Type.String()), checkout_time_start: nullable(Type.String()),
  checkout_time_limit: nullable(Type.String()), is_active: Type.Boolean()
}, strict), { $id: "HotelUpdateInput" });

const RoleAssignmentSchema = Type.Object({ role_id: uuid(), hotel_id: nullable(uuid()) }, strict);
export const UserBodySchema = Type.Object({
  name: Type.String(), email: Type.String({ format: "email" }), password_hash: Type.String({ minLength: 1 }),
  role_assignments: Type.Array(RoleAssignmentSchema)
}, { ...strict, $id: "UserCreateInput" });
export const UserUpdateSchema = Type.Partial(Type.Object({
  name: Type.String(), email: Type.String({ format: "email" }), password_hash: Type.String({ minLength: 1 }),
  is_active: Type.Boolean(), role_assignments: Type.Array(RoleAssignmentSchema)
}, strict), { $id: "UserUpdateInput" });

const RoleTypeSchema = Type.Union([Type.Literal("SYSTEM_ROLE"), Type.Literal("HOTEL_ROLE")]);
const PermissionTypeSchema = Type.Union([Type.Literal("SYSTEM_PERMISSION"), Type.Literal("HOTEL_PERMISSION")]);
export const RoleBodySchema = Type.Object({
  name: Type.String(), role_type: RoleTypeSchema, hotel_id: nullable(uuid()), permission_ids: Type.Array(uuid())
}, { ...strict, $id: "RoleCreateInput" });
export const RoleUpdateSchema = Type.Partial(Type.Object({
  name: Type.String(), role_type: RoleTypeSchema, hotel_id: nullable(uuid()), permission_ids: Type.Array(uuid())
}, strict), { $id: "RoleUpdateInput" });
export const PermissionBodySchema = Type.Object({ name: Type.String(), type: PermissionTypeSchema }, { ...strict, $id: "PermissionCreateInput" });
export const PermissionUpdateSchema = Type.Partial(PermissionBodySchema, { $id: "PermissionUpdateInput" });

const RoomStatusSchema = Type.Union([Type.Literal("available"), Type.Literal("occupied"), Type.Literal("maintenance"), Type.Literal("blocked")]);
export const RoomBodySchema = Type.Object({
  room_number: Type.String(), room_type: Type.String(), max_occupancy: Type.Integer({ minimum: 1 }),
  base_daily_rate: Type.Number({ minimum: 0 }), status: Type.Optional(RoomStatusSchema), notes: optionalNullable(Type.String())
}, { ...strict, $id: "RoomCreateInput" });
export const RoomUpdateSchema = Type.Partial(RoomBodySchema, { $id: "RoomUpdateInput" });

export const CustomerBodySchema = Type.Object({
  full_name: Type.String(), document_number: Type.String(), document_type: Type.String(),
  email: optionalNullable(Type.String({ format: "email" })), mobile_phone: optionalNullable(Type.String()),
  phone: optionalNullable(Type.String()), birth_date: date(), nationality: optionalNullable(Type.String()),
  notes: optionalNullable(Type.String())
}, { ...strict, $id: "CustomerCreateInput" });
export const CustomerUpdateSchema = Type.Partial(CustomerBodySchema, { $id: "CustomerUpdateInput" });

const ProductStatusSchema = Type.Union([Type.Literal("active"), Type.Literal("inactive")]);
export const ProductBodySchema = Type.Object({
  name: Type.String(), category: optionalNullable(Type.String()), unit_price: Type.Number({ minimum: 0 }),
  status: Type.Optional(ProductStatusSchema)
}, { ...strict, $id: "ProductCreateInput" });
export const ProductUpdateSchema = Type.Partial(ProductBodySchema, { $id: "ProductUpdateInput" });

export const SeasonBodySchema = Type.Object({
  name: Type.String(), start_date: date(), end_date: date(), is_active: Type.Optional(Type.Boolean())
}, { ...strict, $id: "SeasonCreateInput" });
export const SeasonUpdateSchema = Type.Partial(SeasonBodySchema, { $id: "SeasonUpdateInput" });
export const SeasonRoomRateBodySchema = Type.Object({
  season_id: uuid(), room_type: Type.String(), daily_rate: Type.Number({ minimum: 0 })
}, { ...strict, $id: "SeasonRoomRateCreateInput" });
export const SeasonRoomRateUpdateSchema = Type.Partial(SeasonRoomRateBodySchema, { $id: "SeasonRoomRateUpdateInput" });

const TransactionTypeSchema = Type.Union([Type.Literal("INCOME"), Type.Literal("EXPENSE"), Type.Literal("REFUND")]);
const TransactionStatusSchema = Type.Union([Type.Literal("PENDING"), Type.Literal("COMPLETED"), Type.Literal("FAILED"), Type.Literal("CANCELLED"), Type.Literal("REFUNDED")]);
export const FinancialTransactionBodySchema = Type.Object({
  type: TransactionTypeSchema, category: Type.String(), amount: Type.Number({ minimum: 0 }),
  currency: Type.Optional(Type.String()), description: optionalNullable(Type.String()),
  status: Type.Optional(TransactionStatusSchema), stay_id: optionalNullable(uuid()), reservation_id: optionalNullable(uuid()),
  payment_method: optionalNullable(Type.String()), paid_at: optionalNullable(dateTime()), due_date: optionalNullable(date()),
  counterparty: optionalNullable(Type.String()), cost_center: optionalNullable(Type.String()), reference_code: optionalNullable(Type.String())
}, { ...strict, $id: "FinancialTransactionCreateInput" });
export const FinancialTransactionUpdateSchema = Type.Partial(FinancialTransactionBodySchema, { $id: "FinancialTransactionUpdateInput" });

const ExistingCustomerSchema = Type.Object({ mode: Type.Literal("existing"), customer_id: uuid() }, strict);
const InlineCustomerSchema = Type.Object({
  mode: Type.Literal("create_inline"), full_name: Type.String(), document_number: Type.String(),
  document_type: Type.String(), birth_date: date(), email: optionalNullable(Type.String({ format: "email" })),
  mobile_phone: optionalNullable(Type.String()), phone: optionalNullable(Type.String()),
  nationality: optionalNullable(Type.String()), notes: optionalNullable(Type.String())
}, strict);
const SelectedCellSchema = Type.Object({
  room_id: uuid(), date: date(), side: Type.Union([Type.Literal("checkin"), Type.Literal("checkout"), Type.Literal("full")])
}, strict);
export const CalendarBookingBodySchema = Type.Object({
  booking_customer: Type.Union([ExistingCustomerSchema, InlineCustomerSchema]), selected_cells: Type.Array(SelectedCellSchema, { minItems: 1 }),
  reservation_source: optionalNullable(Type.Union([Type.Literal("front_desk"), Type.Literal("website"), Type.Literal("phone"), Type.Literal("agency")])),
  notes: optionalNullable(Type.String())
}, { ...strict, $id: "CalendarBookingCreateInput" });
export const StayPaymentBodySchema = Type.Object({
  amount: Type.Number({ exclusiveMinimum: 0 }), method: Type.String(), note: optionalNullable(Type.String()), paid_at: optionalNullable(dateTime())
}, { ...strict, $id: "StayPaymentCreateInput" });

const timestamps = {
  created_at: Type.Optional(Type.String()),
  updated_at: Type.Optional(Type.String())
};
export const HotelSchema = Type.Object({
  id: uuid(), name: Type.String(), legal_name: nullable(Type.String()), tax_id: nullable(Type.String()), slug: Type.String(),
  phone: nullable(Type.String()), address_line: nullable(Type.String()), address_number: nullable(Type.String()),
  address_complement: nullable(Type.String()), district: nullable(Type.String()), city: nullable(Type.String()),
  state: nullable(Type.String()), country: nullable(Type.String()), zip_code: nullable(Type.String()),
  timezone: nullable(Type.String()), currency: nullable(Type.String()), checkin_time_start: optionalNullable(Type.String()),
  checkin_time_limit: optionalNullable(Type.String()), checkout_time_start: optionalNullable(Type.String()),
  checkout_time_limit: optionalNullable(Type.String()), email: nullable(Type.String()), is_active: Type.Boolean(), ...timestamps
}, { ...strict, $id: "Hotel" });
const UserRoleAssignmentSchema = Type.Object({
  role_id: uuid(), role_name: Type.String(), role_type: RoleTypeSchema, hotel_id: nullable(uuid()),
  hotel_name: nullable(Type.String()), role_hotel_id: optionalNullable(uuid()), role_hotel_name: optionalNullable(Type.String())
}, strict);
export const UserSchema = Type.Object({
  id: uuid(), name: Type.String(), email: Type.String(), is_active: Type.Boolean(), last_login_at: optionalNullable(Type.String()),
  created_at: optionalNullable(Type.String()), role_assignments: Type.Array(UserRoleAssignmentSchema)
}, { ...strict, $id: "User" });
const RolePermissionSchema = Type.Object({ id: uuid(), name: Type.String(), type: PermissionTypeSchema }, strict);
export const RoleSchema = Type.Object({
  id: uuid(), name: Type.String(), role_type: RoleTypeSchema, hotel_id: nullable(uuid()), hotel_name: nullable(Type.String()),
  permissions: Type.Array(RolePermissionSchema)
}, { ...strict, $id: "Role" });
export const PermissionSchema = Type.Object({ id: uuid(), name: Type.String(), type: PermissionTypeSchema }, { ...strict, $id: "Permission" });
export const RoomSchema = Type.Object({
  id: uuid(), hotel_id: uuid(), room_number: Type.String(), room_type: Type.String(), max_occupancy: Type.Integer(),
  base_daily_rate: Type.Number(), status: RoomStatusSchema, notes: nullable(Type.String()), ...timestamps
}, { ...strict, $id: "Room" });
export const CustomerSchema = Type.Object({
  id: uuid(), hotel_id: uuid(), full_name: Type.String(), document_number: Type.String(), document_type: Type.String(),
  email: nullable(Type.String()), mobile_phone: nullable(Type.String()), phone: nullable(Type.String()), birth_date: date(),
  nationality: nullable(Type.String()), notes: nullable(Type.String()), ...timestamps
}, { ...strict, $id: "Customer" });
export const ProductSchema = Type.Object({
  id: uuid(), hotel_id: uuid(), name: Type.String(), category: nullable(Type.String()), unit_price: Type.Number(),
  status: ProductStatusSchema, ...timestamps
}, { ...strict, $id: "Product" });
export const SeasonSchema = Type.Object({
  id: uuid(), hotel_id: uuid(), name: Type.String(), start_date: date(), end_date: date(), is_active: Type.Boolean(), ...timestamps
}, { ...strict, $id: "Season" });
export const SeasonRoomRateSchema = Type.Object({
  id: uuid(), season_id: uuid(), hotel_id: uuid(), room_type: Type.String(), daily_rate: Type.Number(), ...timestamps
}, { ...strict, $id: "SeasonRoomRate" });
export const FinancialTransactionSchema = Type.Object({
  id: uuid(), hotel_id: uuid(), type: TransactionTypeSchema, category: Type.String(), amount: Type.Number(), currency: Type.String(),
  description: nullable(Type.String()), status: TransactionStatusSchema, stay_id: optionalNullable(uuid()),
  reservation_id: optionalNullable(uuid()), payment_method: optionalNullable(Type.String()), paid_at: optionalNullable(Type.String()),
  due_date: optionalNullable(date()), counterparty: optionalNullable(Type.String()), cost_center: optionalNullable(Type.String()),
  reference_code: optionalNullable(Type.String()), created_by: optionalNullable(uuid()), ...timestamps
}, { ...strict, $id: "FinancialTransaction" });

const AuthRoleAssignmentSchema = Type.Object({
  roleId: Type.String(), roleName: Type.String(), roleType: RoleTypeSchema, hotelId: nullable(Type.String()),
  hotelName: nullable(Type.String()), permissions: Type.Optional(Type.Array(Type.String()))
}, strict);
export const AuthUserSchema = Type.Object({
  id: Type.String(), name: Type.String(), email: Type.String(), tenantId: nullable(Type.String()),
  roles: Type.Array(Type.String()), permissions: Type.Array(Type.String()), roleAssignments: Type.Array(AuthRoleAssignmentSchema)
}, { ...strict, $id: "AuthUser" });
export const LoginResponseSchema = Type.Object({ token: Type.String(), expiresIn: Type.Integer(), user: AuthUserSchema }, { ...strict, $id: "LoginResponse" });
export const MeResponseSchema = Type.Object({ user: AuthUserSchema }, { ...strict, $id: "MeResponse" });
const HotelOptionSchema = Type.Object({ id: uuid(), name: Type.String() }, strict);
const RoleOptionSchema = Type.Object({ id: uuid(), name: Type.String(), role_type: RoleTypeSchema, hotel_id: nullable(uuid()), hotel_name: nullable(Type.String()) }, strict);
export const UserReferenceDataSchema = Type.Object({ hotels: Type.Array(HotelOptionSchema), roles: Type.Array(RoleOptionSchema) }, { ...strict, $id: "UserReferenceData" });
export const RoleReferenceDataSchema = Type.Object({ hotels: Type.Array(HotelOptionSchema), permissions: Type.Array(PermissionSchema) }, { ...strict, $id: "RoleReferenceData" });

const ReservationStatusSchema = Type.Union([
  Type.Literal("pending"), Type.Literal("confirmed"), Type.Literal("checked_in"), Type.Literal("checked_out"),
  Type.Literal("canceled"), Type.Literal("no_show")
]);
const PaymentStatusSchema = Type.Union([Type.Literal("pending"), Type.Literal("partial"), Type.Literal("paid")]);
const CalendarBreakdownSchema = Type.Object({
  room_id: uuid(), room_number: Type.String(), room_type: Type.String(), date: date(), base_daily_rate: Type.Number(),
  season_extra_rate: Type.Number(), final_daily_rate: Type.Number()
}, strict);
export const CalendarBookingResponseSchema = Type.Object({
  reservation_id: Type.Optional(uuid()), reservation_code: Type.Optional(Type.String()), customer_id: Type.Optional(uuid()),
  stay_ids: Type.Optional(Type.Array(uuid())), total_price: Type.Number(), nights_count: Type.Integer(), rooms_count: Type.Integer(),
  breakdown: Type.Array(CalendarBreakdownSchema)
}, { ...strict, $id: "CalendarBookingResponse" });
export const ReservationCalendarSchema = Type.Object({
  window_start: date(), window_end: date(),
  days: Type.Array(Type.Object({ date: date(), day_number: Type.Integer(), weekday_short: Type.String() }, strict)),
  rooms: Type.Array(Type.Object({ room_id: uuid(), room_number: Type.String(), room_type: Type.String(), max_occupancy: Type.Integer() }, strict)),
  stays: Type.Array(Type.Object({
    id: uuid(), room_id: uuid(), reservation_id: uuid(), reservation_code: nullable(Type.String()), stay_status: nullable(ReservationStatusSchema),
    total_price_estimated: nullable(Type.Number()), total_paid: Type.Number(), stay_payment_status: PaymentStatusSchema,
    customer_name: nullable(Type.String()), checkin_date_expected: date(), checkout_date_expected: date(), start_date: date(), end_date: date(),
    start_half: nullable(Type.Union([Type.Literal("left"), Type.Literal("right")])),
    end_half: nullable(Type.Union([Type.Literal("left"), Type.Literal("right")]))
  }, strict)),
  blocks: Type.Array(Type.Object({ id: uuid(), room_id: uuid(), label: nullable(Type.String()), status: Type.String(), start_date: date(), end_date: date() }, strict)),
  legend: Type.Array(Type.Object({ key: Type.String(), label: Type.String(), color: Type.String() }, strict))
}, { ...strict, $id: "ReservationCalendar" });
const StayPaymentSchema = Type.Object({
  id: uuid(), stay_id: uuid(), amount: Type.Number(), method: Type.String(), note: nullable(Type.String()),
  paid_at: Type.String(), created_at: Type.String(), created_by: nullable(uuid())
}, strict);
export const StayPanelSchema = Type.Object({
  stay: Type.Object({
    id: uuid(), reservation_id: uuid(), reservation_code: nullable(Type.String()), room_id: uuid(), room_number: Type.String(),
    room_type: Type.String(), customer_name: nullable(Type.String()), stay_status: ReservationStatusSchema,
    checkin_date_expected: date(), checkout_date_expected: date(), checkin_date_actual: nullable(Type.String()), checkout_date_actual: nullable(Type.String()),
    total_price_estimated: Type.Number(), total_paid: Type.Number(), stay_payment_status: PaymentStatusSchema
  }, strict),
  reservation: Type.Object({ id: uuid(), code: nullable(Type.String()), total_due: Type.Number(), total_paid: Type.Number(), payment_status: PaymentStatusSchema }, strict),
  hotel: Type.Object({
    id: uuid(), timezone: Type.String(), checkin_time_start: nullable(Type.String()), checkin_time_limit: nullable(Type.String()),
    checkout_time_start: nullable(Type.String()), checkout_time_limit: nullable(Type.String())
  }, strict),
  eligibility: Type.Object({
    can_checkin: Type.Boolean(), checkin_block_reason: nullable(Type.String()), can_checkout: Type.Boolean(), checkout_block_reason: nullable(Type.String()),
    can_no_show: Type.Boolean(), no_show_block_reason: nullable(Type.String()), can_cancel: Type.Boolean(), cancel_block_reason: nullable(Type.String())
  }, strict),
  payments: Type.Array(StayPaymentSchema)
}, { ...strict, $id: "StayPanel" });

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
  Assert<Compatible<typeof SeasonRoomRateBodySchema, AdminSeasonRoomRateCreateInput>>,
  Assert<Compatible<typeof FinancialTransactionBodySchema, AdminFinancialTransactionCreateInput>>,
  Assert<Compatible<typeof CalendarBookingBodySchema, AdminReservationCalendarBookingCreateInput>>,
  Assert<Compatible<typeof StayPaymentBodySchema, AdminStayPaymentCreateInput>>
];
export type { ContractCompatibility };

export const API_COMPONENT_SCHEMAS = [
  ApiErrorSchema, LoginBodySchema, HotelBodySchema, HotelUpdateSchema, UserBodySchema, UserUpdateSchema,
  RoleBodySchema, RoleUpdateSchema, PermissionBodySchema, PermissionUpdateSchema, RoomBodySchema, RoomUpdateSchema,
  CustomerBodySchema, CustomerUpdateSchema, ProductBodySchema, ProductUpdateSchema, SeasonBodySchema, SeasonUpdateSchema,
  SeasonRoomRateBodySchema, SeasonRoomRateUpdateSchema, FinancialTransactionBodySchema, FinancialTransactionUpdateSchema,
  CalendarBookingBodySchema, StayPaymentBodySchema, HotelSchema, UserSchema, RoleSchema, PermissionSchema,
  RoomSchema, CustomerSchema, ProductSchema, SeasonSchema, SeasonRoomRateSchema, FinancialTransactionSchema,
  AuthUserSchema, LoginResponseSchema, MeResponseSchema, UserReferenceDataSchema, RoleReferenceDataSchema,
  CalendarBookingResponseSchema, ReservationCalendarSchema, StayPanelSchema
] as const;

const AuthHeadersSchema = Type.Object({
  authorization: Type.Optional(Type.String()), "x-active-hotel-id": Type.Optional(Type.String())
}, { additionalProperties: true });
const IdParamsSchema = Type.Object({ id: uuid() }, strict);
const OkSchema = Type.Object({ ok: Type.Boolean() }, strict);
const listSchema = (item: TSchema) => Type.Object({ items: Type.Array(item) }, strict);
const itemSchema = (item: TSchema) => Type.Object({ item }, strict);
const adminErrors = { 400: ApiErrorSchema, 401: ApiErrorSchema, 403: ApiErrorSchema, 404: ApiErrorSchema, 409: ApiErrorSchema, 500: ApiErrorSchema };

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

const route = (operationId: string, tag: string, description: string, config: Partial<ApiRouteContract> & Pick<ApiRouteContract, "response">): ApiRouteContract => ({
  operationId, tags: [tag], description, ...config
});
const admin = (operationId: string, tag: string, description: string, response: TSchema, config: Partial<ApiRouteContract> = {}): ApiRouteContract =>
  route(operationId, tag, description, { headers: AuthHeadersSchema, security: [{ bearerAuth: [] }], ...config, response: { 200: response, ...adminErrors } });
const crud = (base: string, tag: string, path: string, entity: TSchema, createBody: TSchema, updateBody: TSchema): Record<string, ApiRouteContract> => ({
  [`GET ${path}`]: admin(`list${base}`, tag, `Lista ${tag.toLowerCase()}.`, listSchema(entity)),
  [`POST ${path}`]: route(`create${base}`, tag, `Cria um registro de ${tag.toLowerCase()}.`, {
    headers: AuthHeadersSchema,
    security: [{ bearerAuth: [] }],
    body: createBody,
    response: { 201: itemSchema(entity), ...adminErrors }
  }),
  [`PUT ${path}/:id`]: admin(`update${base}`, tag, `Atualiza um registro de ${tag.toLowerCase()}.`, itemSchema(entity), { params: IdParamsSchema, body: updateBody }),
  [`DELETE ${path}/:id`]: admin(`delete${base}`, tag, `Remove um registro de ${tag.toLowerCase()}.`, OkSchema, { params: IdParamsSchema })
});

export const API_ROUTE_CONTRACTS: Readonly<Record<string, ApiRouteContract>> = {
  "GET /health": route("getHealth", "System", "Verifica a disponibilidade do serviço.", { response: { 200: Type.Object({ status: Type.Literal("ok"), service: Type.String() }, strict) } }),
  "POST /auth/login": route("login", "Authentication", "Autentica um usuário e emite uma sessão.", { body: LoginBodySchema, response: { 200: LoginResponseSchema, 400: ApiErrorSchema, 401: ApiErrorSchema, 429: ApiErrorSchema, 500: ApiErrorSchema } }),
  "GET /auth/me": route("getCurrentUser", "Authentication", "Retorna o usuário da sessão atual.", { headers: AuthHeadersSchema, security: [{ bearerAuth: [] }], response: { 200: MeResponseSchema, 401: ApiErrorSchema, 500: ApiErrorSchema } }),
  ...crud("Hotel", "Hotels", "/admin/hotels", HotelSchema, HotelBodySchema, HotelUpdateSchema),
  "GET /admin/users/reference-data": admin("getUserReferenceData", "Users", "Lista hotéis e papéis disponíveis para usuários.", UserReferenceDataSchema),
  ...crud("User", "Users", "/admin/users", UserSchema, UserBodySchema, UserUpdateSchema),
  "GET /admin/roles/reference-data": admin("getRoleReferenceData", "Roles", "Lista hotéis e permissões disponíveis para papéis.", RoleReferenceDataSchema),
  ...crud("Role", "Roles", "/admin/roles", RoleSchema, RoleBodySchema, RoleUpdateSchema),
  ...crud("Permission", "Permissions", "/admin/permissions", PermissionSchema, PermissionBodySchema, PermissionUpdateSchema),
  ...crud("Room", "Rooms", "/admin/rooms", RoomSchema, RoomBodySchema, RoomUpdateSchema),
  ...crud("Customer", "Customers", "/admin/customers", CustomerSchema, CustomerBodySchema, CustomerUpdateSchema),
  ...crud("Product", "Products", "/admin/products", ProductSchema, ProductBodySchema, ProductUpdateSchema),
  ...crud("Season", "Seasons", "/admin/seasons", SeasonSchema, SeasonBodySchema, SeasonUpdateSchema),
  ...crud("SeasonRoomRate", "Season room rates", "/admin/season-room-rates", SeasonRoomRateSchema, SeasonRoomRateBodySchema, SeasonRoomRateUpdateSchema),
  ...crud("FinancialTransaction", "Financial transactions", "/admin/financial-transactions", FinancialTransactionSchema, FinancialTransactionBodySchema, FinancialTransactionUpdateSchema),
  "GET /admin/reservations/calendar": admin("getReservationCalendar", "Reservations", "Consulta o calendário de reservas.", ReservationCalendarSchema, { querystring: Type.Object({ start_date: Type.Optional(date()), days: Type.Optional(Type.String({ pattern: "^[0-9]+$" })) }, strict) }),
  "POST /admin/reservations/calendar/booking/simulate": admin("simulateCalendarBooking", "Reservations", "Simula disponibilidade e preço de uma reserva.", itemSchema(CalendarBookingResponseSchema), { body: CalendarBookingBodySchema }),
  "POST /admin/reservations/calendar/booking": route("createCalendarBooking", "Reservations", "Cria uma reserva a partir do calendário.", { headers: AuthHeadersSchema, security: [{ bearerAuth: [] }], body: CalendarBookingBodySchema, response: { 201: itemSchema(CalendarBookingResponseSchema), ...adminErrors } }),
  "GET /admin/stays/checkout-candidate": admin("getCheckoutCandidate", "Stays", "Localiza uma estadia candidata a checkout.", itemSchema(StayPanelSchema), { querystring: Type.Object({ room_number: Type.Optional(Type.String()) }, strict) }),
  "GET /admin/stays/:id/panel": admin("getStayPanel", "Stays", "Retorna o painel operacional da estadia.", itemSchema(StayPanelSchema), { params: IdParamsSchema }),
  "POST /admin/stays/:id/payments": admin("createStayPayment", "Stays", "Registra um pagamento da estadia.", itemSchema(StayPanelSchema), { params: IdParamsSchema, body: StayPaymentBodySchema }),
  "POST /admin/stays/:id/checkin": admin("checkInStay", "Stays", "Realiza o check-in da estadia.", itemSchema(StayPanelSchema), { params: IdParamsSchema }),
  "POST /admin/stays/:id/checkout": admin("checkOutStay", "Stays", "Realiza o checkout da estadia.", itemSchema(StayPanelSchema), { params: IdParamsSchema }),
  "POST /admin/stays/:id/no-show": admin("markStayNoShow", "Stays", "Marca a estadia como no-show.", itemSchema(StayPanelSchema), { params: IdParamsSchema }),
  "POST /admin/stays/:id/cancel": admin("cancelStay", "Stays", "Cancela a estadia.", itemSchema(StayPanelSchema), { params: IdParamsSchema })
};
