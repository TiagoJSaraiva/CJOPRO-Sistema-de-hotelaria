export type AdminListResponse<T> = {
  items: T[];
};

export type AdminItemResponse<T> = {
  item: T;
};

export type AdminOkResponse = {
  ok: boolean;
};

export const ADMIN_ERROR_CODE = {
  FORBIDDEN: "ADMIN_FORBIDDEN",
  SCOPE_NOT_ALLOWED: "ADMIN_SCOPE_NOT_ALLOWED",
  VALIDATION: "ADMIN_VALIDATION_ERROR",
  NOT_FOUND: "ADMIN_NOT_FOUND",
  CONFLICT: "ADMIN_CONFLICT",
  INTERNAL: "ADMIN_INTERNAL_ERROR",
  SELF_ACTION_FORBIDDEN: "ADMIN_SELF_ACTION_FORBIDDEN",
} as const;

export type AdminErrorCode =
  (typeof ADMIN_ERROR_CODE)[keyof typeof ADMIN_ERROR_CODE];

export type AdminErrorResponse = {
  code: AdminErrorCode;
  message: string;
  details?: string;
};

export const ADMIN_PERMISSION_TYPES = {
  SYSTEM: "SYSTEM_PERMISSION",
  HOTEL: "HOTEL_PERMISSION",
} as const;

export type AdminPermissionType =
  (typeof ADMIN_PERMISSION_TYPES)[keyof typeof ADMIN_PERMISSION_TYPES];

export const ADMIN_ROLE_TYPES = {
  SYSTEM: "SYSTEM_ROLE",
  HOTEL: "HOTEL_ROLE",
} as const;

export type AdminRoleType =
  (typeof ADMIN_ROLE_TYPES)[keyof typeof ADMIN_ROLE_TYPES];

export type HotelIdParams = {
  id: string;
};

export type AdminHotelOption = {
  id: string;
  name: string;
};

export type AdminHotel = {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  slug: string;
  phone: string | null;
  address_line: string | null;
  address_number: string | null;
  address_complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  timezone: string | null;
  currency: string | null;
  checkin_time_start?: string | null;
  checkin_time_limit?: string | null;
  checkout_time_start?: string | null;
  checkout_time_limit?: string | null;
  email: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AdminHotelCreateInput = {
  name: string;
  legal_name: string;
  tax_id: string;
  slug: string;
  email: string;
  phone: string;
  address_line: string;
  address_number: string;
  address_complement: string | null;
  district: string;
  city: string;
  state: string;
  country: string;
  zip_code: string;
  timezone: string | null;
  currency: string | null;
  checkin_time_start?: string | null;
  checkin_time_limit?: string | null;
  checkout_time_start?: string | null;
  checkout_time_limit?: string | null;
};

export type AdminHotelUpdateInput = {
  name?: string;
  legal_name?: string;
  tax_id?: string;
  slug?: string;
  email?: string | null;
  phone?: string | null;
  address_line?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip_code?: string | null;
  timezone?: string | null;
  currency?: string | null;
  category_ids?: string[];
  location_ids?: string[];
  checkin_time_start?: string | null;
  checkin_time_limit?: string | null;
  checkout_time_start?: string | null;
  checkout_time_limit?: string | null;
  is_active?: boolean;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
  role_assignments: AdminUserRoleAssignment[];
};

export type AdminUserRoleAssignment = {
  role_id: string;
  role_name: string;
  role_type: AdminRoleType;
  hotel_id: string | null;
  hotel_name: string | null;
  role_hotel_id?: string | null;
  role_hotel_name?: string | null;
};

export type AdminUserRoleAssignmentInput = {
  role_id: string;
  hotel_id: string | null;
};

export type AdminUserCreateInput = {
  name: string;
  email: string;
  password_hash: string;
  role_assignments: AdminUserRoleAssignmentInput[];
};

export type AdminUserUpdateInput = {
  name?: string;
  email?: string;
  password_hash?: string;
  is_active?: boolean;
  role_assignments?: AdminUserRoleAssignmentInput[];
};

export type AdminRolePermission = {
  id: string;
  name: string;
  type: AdminPermissionType;
};

export type AdminRole = {
  id: string;
  name: string;
  role_type: AdminRoleType;
  hotel_id: string | null;
  hotel_name: string | null;
  permissions: AdminRolePermission[];
};

export type AdminRoleOption = {
  id: string;
  name: string;
  role_type: AdminRoleType;
  hotel_id: string | null;
  hotel_name: string | null;
};

export type AdminRoleCreateInput = {
  name: string;
  role_type: AdminRoleType;
  hotel_id: string | null;
  permission_ids: string[];
};

export type AdminRoleUpdateInput = {
  name?: string;
  role_type?: AdminRoleType;
  hotel_id?: string | null;
  permission_ids?: string[];
};

export type AdminPermission = {
  id: string;
  name: string;
  type: AdminPermissionType;
};

export type AdminPermissionOption = AdminPermission;

export type AdminPermissionCreateInput = {
  name: string;
  type: AdminPermissionType;
};

export type AdminPermissionUpdateInput = {
  name?: string;
  type?: AdminPermissionType;
};

export type AdminUsersReferenceData = {
  hotels: AdminHotelOption[];
  roles: AdminRoleOption[];
};

export type AdminRolesReferenceData = {
  hotels: AdminHotelOption[];
  permissions: AdminPermissionOption[];
};

export type RoomStatus = "available" | "occupied" | "maintenance" | "blocked";

export type AdminRoom = {
  id: string;
  hotel_id: string;
  room_number: string;
  room_type: string;
  max_occupancy: number;
  base_daily_rate: number;
  status: RoomStatus;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminRoomCreateInput = {
  room_number: string;
  room_type: string;
  max_occupancy: number;
  base_daily_rate: number;
  status?: RoomStatus;
  notes?: string | null;
};

export type AdminRoomUpdateInput = Partial<AdminRoomCreateInput>;

export type AdminCustomer = {
  id: string;
  hotel_id: string;
  full_name: string;
  document_number: string;
  document_type: string;
  email: string | null;
  mobile_phone: string | null;
  phone: string | null;
  birth_date: string;
  nationality: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminCustomerCreateInput = {
  full_name: string;
  document_number: string;
  document_type: string;
  email?: string | null;
  mobile_phone?: string | null;
  phone?: string | null;
  birth_date: string;
  nationality?: string | null;
  notes?: string | null;
};

export type AdminCustomerUpdateInput = Partial<AdminCustomerCreateInput>;

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "canceled"
  | "no_show";
export type ReservationSource = "front_desk" | "website" | "phone" | "agency";
export type PaymentStatus = "pending" | "partial" | "paid" | "refunded";

export type AdminReservation = {
  id: string;
  hotel_id: string;
  booking_customer_id: string;
  reservation_code: string;
  guest_count: number;
  reservation_source: ReservationSource | null;
  estimated_total_price: number | null;
  final_total_price: number | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminReservationCreateInput = {
  booking_customer_id?: string;
  booking_customer_document?: string | null;
  booking_customer_document_type?: string | null;
  reservation_code?: string;
  guest_count: number;
  reservation_source?: ReservationSource | null;
  estimated_total_price?: number | null;
  final_total_price?: number | null;
  notes?: string | null;
};

export type AdminReservationUpdateInput = Partial<AdminReservationCreateInput>;

export type TransactionType = "INCOME" | "EXPENSE" | "REFUND";
export type TransactionStatus =
  "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REFUNDED";

export type AdminFinancialTransaction = {
  id: string;
  hotel_id: string;
  type: TransactionType;
  category: string;
  amount: number;
  currency: string;
  description: string | null;
  status: TransactionStatus;
  stay_id?: string | null;
  reservation_id?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  due_date?: string | null;
  counterparty?: string | null;
  cost_center?: string | null;
  reference_code?: string | null;
  created_by?: string | null;
  maintenance_cost_item_id?: string | null;
  maintenance_recovery_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminFinancialTransactionCreateInput = {
  type: TransactionType;
  category: string;
  amount: number;
  currency?: string;
  description?: string | null;
  status?: TransactionStatus;
  stay_id?: string | null;
  reservation_id?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  due_date?: string | null;
  counterparty?: string | null;
  cost_center?: string | null;
  reference_code?: string | null;
};

export type AdminFinancialTransactionUpdateInput =
  Partial<AdminFinancialTransactionCreateInput>;

export type ProductStatus = "active" | "inactive";

export type ProductKind = "physical" | "service";
export type ProductSalesUnit =
  "unit" | "portion" | "person" | "hour" | "daily" | "service";

export type AdminProductCategory = {
  id: string;
  hotel_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  archived_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminProductCategoryInput = {
  name: string;
  display_order?: number;
  is_active?: boolean;
};

export type AdminCatalogAuditEvent = {
  id: string;
  hotel_id: string;
  entity_type: "product" | "product_category";
  entity_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  changes: Record<string, unknown>;
  created_at: string;
};

export type ProductProviderType = "hotel" | "partner";
export type CommercialContactPurpose = "operational" | "financial" | "general";
export type CommercialModel = "fixed_rent" | "revenue_share" | "hybrid";
export type CommercialRentFrequency = "monthly" | "quarterly" | "yearly";
export type CommercialPaymentRecipient = "hotel" | "partner" | "both";
export type CommercialRevisionStatus = "draft" | "activated" | "terminated";
export type CommercialRevisionEffectiveStatus =
  "draft" | "scheduled" | "current" | "expired" | "terminated" | "superseded";

export type AdminCommercialPartnerSummary = {
  id: string;
  trade_name: string;
  is_active: boolean;
  archived_at: string | null;
};

export type AdminProductProvider =
  | { type: "hotel"; partner: null }
  | {
      type: "partner";
      partner: Pick<AdminCommercialPartnerSummary, "id" | "trade_name">;
    };

export type AdminProduct = {
  id: string;
  hotel_id: string;
  name: string;
  category: AdminProductCategory;
  description: string | null;
  internal_code: string | null;
  kind: ProductKind;
  sales_unit: ProductSalesUnit;
  unit_price: number;
  status: ProductStatus;
  archived_at: string | null;
  provider: AdminProductProvider;
  created_at?: string;
  updated_at?: string;
};

export type AdminProductCreateInput = {
  name: string;
  category_id: string;
  description?: string | null;
  internal_code?: string | null;
  kind: ProductKind;
  sales_unit: ProductSalesUnit;
  unit_price: number;
  status?: ProductStatus;
  provider_type?: ProductProviderType;
  commercial_partner_id?: string | null;
};

export type AdminProductUpdateInput = Partial<
  Omit<AdminProductCreateInput, "provider_type" | "commercial_partner_id">
>;

export type AdminCommercialPartner = AdminCommercialPartnerSummary & {
  hotel_id: string;
  legal_name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  contacts: AdminCommercialPartnerContact[];
  created_at?: string;
  updated_at?: string;
};

export type AdminCommercialPartnerInput = {
  trade_name: string;
  legal_name: string;
  tax_id?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

export type AdminCommercialPartnerContact = {
  id: string;
  hotel_id: string;
  partner_id: string;
  name: string;
  role: string | null;
  purpose: CommercialContactPurpose;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_active: boolean;
  archived_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminCommercialPartnerContactInput = {
  name: string;
  role?: string | null;
  purpose: CommercialContactPurpose;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean;
  is_active?: boolean;
};

export type AdminCommercialAgreementRevision = {
  id: string;
  hotel_id: string;
  agreement_id: string;
  version: number;
  starts_on: string;
  ends_on: string | null;
  status: CommercialRevisionStatus;
  effective_status: CommercialRevisionEffectiveStatus;
  commercial_model: CommercialModel;
  fixed_rent: number | null;
  rent_frequency: CommercialRentFrequency | null;
  commission_percentage: number | null;
  minimum_guarantee: number | null;
  payment_recipient: CommercialPaymentRecipient;
  currency: string;
  notes: string | null;
  point_ids: string[];
  activated_at: string | null;
  terminated_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminCommercialAgreementRevisionInput = {
  starts_on: string;
  ends_on?: string | null;
  commercial_model: CommercialModel;
  fixed_rent?: number | null;
  rent_frequency?: CommercialRentFrequency | null;
  commission_percentage?: number | null;
  minimum_guarantee?: number | null;
  payment_recipient: CommercialPaymentRecipient;
  notes?: string | null;
  point_ids: string[];
};

export type AdminCommercialAgreement = {
  id: string;
  hotel_id: string;
  partner: AdminCommercialPartnerSummary;
  internal_number: string;
  archived_at: string | null;
  revisions: AdminCommercialAgreementRevision[];
  current_revision: AdminCommercialAgreementRevision | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminCommercialAgreementCreateInput = {
  partner_id: string;
  internal_number: string;
  revision: AdminCommercialAgreementRevisionInput;
};

export type AdminCommercialAgreementEligibility = {
  agreement_id: string;
  internal_number: string;
  eligible: boolean;
  reason: string | null;
  revision: AdminCommercialAgreementRevision | null;
};

export type AdminCommercialAuditEvent = {
  id: string;
  hotel_id: string;
  entity_type:
    | "partner"
    | "partner_contact"
    | "agreement"
    | "agreement_revision"
    | "agreement_revision_point";
  entity_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  changes: Record<string, unknown>;
  created_at: string;
};

export type ConsumptionBillingMode =
  "hotel_immediate" | "stay_folio" | "partner_direct";
export type ConsumptionPolicySource = "inherit" | "override";
export type ConsumptionUnavailableReason =
  | "point_inactive"
  | "point_archived"
  | "offer_inactive"
  | "offer_archived"
  | "product_inactive"
  | "product_archived"
  | "category_inactive"
  | "category_archived"
  | "partner_inactive"
  | "partner_archived"
  | "agreement_missing"
  | "agreement_draft"
  | "agreement_scheduled"
  | "agreement_expired"
  | "agreement_terminated"
  | "agreement_outside_point"
  | "billing_mode_incompatible"
  | "agreement_revision_missing";

export type AdminConsumptionBillingPolicy = {
  allowed_modes: ConsumptionBillingMode[];
  default_mode: ConsumptionBillingMode;
};

export type AdminConsumptionPoint = {
  id: string;
  hotel_id: string;
  name: string;
  internal_code: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  default_policy: AdminConsumptionBillingPolicy;
  inherited_offers_count: number;
  offers_count: number;
  archived_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminConsumptionPointInput = {
  name: string;
  internal_code?: string | null;
  description?: string | null;
  display_order?: number;
  is_active?: boolean;
  default_policy: AdminConsumptionBillingPolicy;
};

export type AdminConsumptionOfferPolicyInput =
  | { source: "inherit" }
  | {
      source: "override";
      allowed_modes: ConsumptionBillingMode[];
      default_mode: ConsumptionBillingMode;
    };

export type AdminConsumptionOffer = {
  id: string;
  hotel_id: string;
  point: Pick<
    AdminConsumptionPoint,
    "id" | "name" | "internal_code" | "is_active" | "archived_at"
  >;
  product: AdminProduct;
  display_order: number;
  is_active: boolean;
  policy: AdminConsumptionOfferPolicyInput;
  resolved_policy: AdminConsumptionBillingPolicy & {
    source: ConsumptionPolicySource;
  };
  effective_available: boolean;
  unavailable_reasons: ConsumptionUnavailableReason[];
  commercial_agreement: Pick<
    AdminCommercialAgreement,
    "id" | "internal_number"
  > | null;
  commercial_revision: AdminCommercialAgreementRevision | null;
  archived_at: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminConsumptionOfferBatchInput = {
  product_ids: string[];
  policy: AdminConsumptionOfferPolicyInput;
  commercial_agreement_id?: string | null;
};

export type AdminConsumptionOfferUpdateInput = {
  display_order?: number;
  is_active?: boolean;
  policy?: AdminConsumptionOfferPolicyInput;
  commercial_agreement_id?: string | null;
};

export type AdminConsumptionReorderInput = { ids: string[] };

export type AdminConsumptionConfigurationAuditEvent = {
  id: string;
  hotel_id: string;
  entity_type: "consumption_point" | "consumption_offer";
  entity_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  changes: Record<string, unknown>;
  created_at: string;
};

export type ConsumptionOrderDisposition =
  "charged" | "courtesy" | "legacy_unclassified";
export type ConsumptionPaymentMethod =
  "cash" | "pix" | "credit_card" | "debit_card" | "bank_transfer";
export type ConsumptionOrderConflictReason =
  | "stay_not_checked_in"
  | "invalid_occurred_at"
  | "offer_unavailable"
  | "billing_mode_incompatible"
  | "price_changed"
  | "revision_changed"
  | "different_partners"
  | "financial_permission_required"
  | "idempotency_conflict";

export type AdminConsumptionEligibleStay = {
  id: string;
  reservation_id: string;
  reservation_code: string;
  room_number: string;
  room_type: string;
  primary_guest_name: string;
  checkin_date_actual: string;
};

export type AdminConsumptionContextGuest = {
  id: string;
  full_name: string;
};

export type AdminConsumptionContextOffer = {
  id: string;
  point_id: string;
  point_name: string;
  product_id: string;
  product_name: string;
  product_code: string | null;
  product_kind: ProductKind;
  sales_unit: ProductSalesUnit;
  category_id: string;
  category_name: string;
  unit_price: number;
  currency: string;
  provider_type: ProductProviderType;
  partner_id: string | null;
  partner_name: string | null;
  agreement_id: string | null;
  agreement_number: string | null;
  revision: {
    id: string;
    version: number;
    starts_on: string;
    ends_on: string | null;
    commercial_model: CommercialModel;
    fixed_rent: number | null;
    rent_frequency: CommercialRentFrequency | null;
    commission_percentage: number | null;
    minimum_guarantee: number | null;
    payment_recipient: CommercialPaymentRecipient;
    currency: string;
  } | null;
  allowed_modes: ConsumptionBillingMode[];
  default_mode: ConsumptionBillingMode | null;
  policy_source: ConsumptionPolicySource;
  available: boolean;
  reasons: ConsumptionUnavailableReason[];
  version_token: string;
};

export type AdminConsumptionOperationalContext = {
  stay: AdminConsumptionEligibleStay & {
    stay_status: "checked_in";
    room_id: string;
    checkout_date_expected: string;
  };
  guests: AdminConsumptionContextGuest[];
  offers: AdminConsumptionContextOffer[];
  occurred_at: string;
};

export type AdminConsumptionOrderLineInput = {
  offer_id: string;
  quantity: number;
  version_token: string;
};

export type AdminConsumptionOrderCreateInput = {
  stay_id: string;
  point_id: string;
  guest_customer_id?: string | null;
  occurred_at: string;
  disposition: Exclude<ConsumptionOrderDisposition, "legacy_unclassified">;
  billing_mode?: ConsumptionBillingMode | null;
  payment_method?: ConsumptionPaymentMethod | null;
  payment_reference?: string | null;
  partner_receipt_confirmed?: boolean;
  courtesy_reason?: string | null;
  notes?: string | null;
  idempotency_key: string;
  lines: AdminConsumptionOrderLineInput[];
};

export type AdminConsumptionOrderItem = {
  id: string;
  offer_id: string | null;
  product_id: string;
  quantity: number;
  charged_unit_price: number;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  product_name: string;
  product_code: string | null;
  category_name: string;
  product_kind: ProductKind;
  sales_unit: ProductSalesUnit;
  provider_type: ProductProviderType;
  partner_id: string | null;
  partner_name: string | null;
  agreement_id: string | null;
  agreement_number: string | null;
  commercial_revision_id: string | null;
  commercial_revision_version: number | null;
  commercial_terms?: Record<string, unknown> | null;
  billing_policy: Record<string, unknown>;
  version_token: string;
  notes: string | null;
};

export type AdminConsumptionOrderEvent = {
  id: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type AdminConsumptionOrder = {
  id: string;
  hotel_id: string;
  stay_id: string | null;
  reservation_id: string | null;
  point_id: string | null;
  guest_customer_id: string | null;
  disposition: ConsumptionOrderDisposition;
  billing_mode: ConsumptionBillingMode | null;
  payment_method: ConsumptionPaymentMethod | null;
  payment_reference: string | null;
  partner_receipt_confirmed: boolean;
  currency: string;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  reservation_code: string | null;
  room_number: string | null;
  guest_name: string | null;
  point_name: string | null;
  notes: string | null;
  courtesy_reason: string | null;
  occurred_at: string;
  posted_at: string;
  posted_by: string | null;
  operator_name: string | null;
  is_legacy: boolean;
  items: AdminConsumptionOrderItem[];
  events?: AdminConsumptionOrderEvent[];
  folio_entry_ids?: string[];
  financial_transaction_ids?: string[];
};

export type AdminConsumptionOrderHistory = {
  items: AdminConsumptionOrder[];
  next_cursor: string | null;
};

export type AdminSeason = {
  id: string;
  hotel_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AdminSeasonCreateInput = {
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
};

export type AdminSeasonUpdateInput = Partial<AdminSeasonCreateInput>;

export type AdminSeasonRoomRate = {
  id: string;
  season_id: string;
  hotel_id: string;
  room_type: string;
  daily_rate: number;
  created_at?: string;
  updated_at?: string;
};

export type AdminSeasonRoomRateCreateInput = {
  season_id: string;
  room_type: string;
  daily_rate: number;
};

export type AdminSeasonRoomRateUpdateInput =
  Partial<AdminSeasonRoomRateCreateInput>;

export type AdminReservationCalendarDay = {
  date: string;
  day_number: number;
  weekday_short: string;
};

export type AdminReservationCalendarRoomRow = {
  room_id: string;
  room_number: string;
  room_type: string;
  max_occupancy: number;
};

export type AdminReservationCalendarStayBlock = {
  id: string;
  room_id: string;
  reservation_id: string;
  reservation_code: string | null;
  stay_status: ReservationStatus | null;
  total_price_estimated: number | null;
  total_paid: number;
  stay_payment_status: "pending" | "partial" | "paid";
  customer_name: string | null;
  checkin_date_expected: string;
  checkout_date_expected: string;
  start_date: string;
  end_date: string;
  start_half: "left" | "right" | null;
  end_half: "left" | "right" | null;
};

export type AdminReservationCalendarRoomBlock = {
  id: string;
  room_id: string;
  label: string | null;
  status: string;
  start_date: string;
  end_date: string;
  maintenance_occurrence_id?: string | null;
  occurrence_code?: string | null;
  is_overdue?: boolean;
};

export type AdminReservationCalendarLegendItem = {
  key: string;
  label: string;
  color: string;
};

export type AdminReservationCalendarResponse = {
  window_start: string;
  window_end: string;
  days: AdminReservationCalendarDay[];
  rooms: AdminReservationCalendarRoomRow[];
  stays: AdminReservationCalendarStayBlock[];
  blocks: AdminReservationCalendarRoomBlock[];
  legend: AdminReservationCalendarLegendItem[];
};

export type AdminReservationCalendarBookingCustomer =
  | {
      mode: "existing";
      customer_id: string;
    }
  | {
      mode: "create_inline";
      full_name: string;
      document_number: string;
      document_type: string;
      birth_date: string;
      email?: string | null;
      mobile_phone?: string | null;
      phone?: string | null;
      nationality?: string | null;
      notes?: string | null;
    };

export type AdminReservationCalendarSelectedCell = {
  room_id: string;
  date: string;
  side: "checkin" | "checkout" | "full";
};

export type AdminReservationCalendarBookingCreateInput = {
  booking_customer: AdminReservationCalendarBookingCustomer;
  selected_cells: AdminReservationCalendarSelectedCell[];
  reservation_source?: ReservationSource | null;
  notes?: string | null;
};

export type AdminReservationCalendarBookingPriceBreakdown = {
  room_id: string;
  room_number: string;
  room_type: string;
  date: string;
  base_daily_rate: number;
  season_extra_rate: number;
  final_daily_rate: number;
};

export type AdminReservationCalendarBookingCreateResponse = {
  reservation_id?: string;
  reservation_code?: string;
  customer_id?: string;
  stay_ids?: string[];
  total_price: number;
  nights_count: number;
  rooms_count: number;
  breakdown: AdminReservationCalendarBookingPriceBreakdown[];
};

export type AdminStayPaymentStatus = "pending" | "partial" | "paid";

export type AdminStayPayment = {
  id: string;
  stay_id: string;
  amount: number;
  method: string;
  note: string | null;
  paid_at: string;
  created_at: string;
  created_by: string | null;
};

export type AdminStayPaymentCreateInput = {
  amount: number;
  method: string;
  note?: string | null;
  paid_at?: string | null;
  allocations?: AdminStayFolioAllocationInput[];
};

export type StayFolioDirection = "debit" | "credit";
export type StayFolioKind =
  | "lodging"
  | "maintenance_charge"
  | "consumption_charge"
  | "payment"
  | "refund"
  | "adjustment";

export type AdminStayFolioEntry = {
  id: string;
  stay_id: string;
  reservation_id: string;
  direction: StayFolioDirection;
  kind: StayFolioKind;
  amount: number;
  currency: string;
  description: string;
  maintenance_occurrence_id: string | null;
  consumption_order_id?: string | null;
  financial_transaction_id: string | null;
  reversed_entry_id: string | null;
  allocated_amount: number;
  open_amount: number;
  posted_at: string;
};

export type AdminStayFolioAllocation = {
  id: string;
  credit_entry_id: string;
  debit_entry_id: string;
  amount: number;
  created_at: string;
};

export type AdminStayFolioAllocationInput = {
  debit_entry_id: string;
  amount: number;
};

export type AdminStayFolioResponse = {
  stay_id: string;
  currency: string;
  entries: AdminStayFolioEntry[];
  allocations: AdminStayFolioAllocation[];
  total_debits: number;
  total_credits: number;
  balance: number;
  payment_status: AdminStayPaymentStatus;
  pending_maintenance_entry_ids: string[];
};

export type AdminStayFolioAllocationPreview = {
  amount: number;
  allocations: AdminStayFolioAllocationInput[];
  unallocated_amount: number;
};

export type AdminStayOperationalPanelResponse = {
  stay: {
    id: string;
    reservation_id: string;
    reservation_code: string | null;
    room_id: string;
    room_number: string;
    room_type: string;
    customer_name: string | null;
    stay_status: ReservationStatus;
    checkin_date_expected: string;
    checkout_date_expected: string;
    checkin_date_actual: string | null;
    checkout_date_actual: string | null;
    total_price_estimated: number;
    total_paid: number;
    stay_payment_status: AdminStayPaymentStatus;
  };
  reservation: {
    id: string;
    code: string | null;
    total_due: number;
    total_paid: number;
    payment_status: AdminStayPaymentStatus;
  };
  hotel: {
    id: string;
    timezone: string;
    checkin_time_start: string | null;
    checkin_time_limit: string | null;
    checkout_time_start: string | null;
    checkout_time_limit: string | null;
  };
  eligibility: {
    can_checkin: boolean;
    checkin_block_reason: string | null;
    can_checkout: boolean;
    checkout_block_reason: string | null;
    can_no_show: boolean;
    no_show_block_reason: string | null;
    can_cancel: boolean;
    cancel_block_reason: string | null;
  };
  payments: AdminStayPayment[];
  folio?: AdminStayFolioResponse;
  maintenance_occurrences?: AdminMaintenanceOccurrenceSummary[];
  maintenance_acknowledgement_required?: boolean;
  maintenance_financial_acknowledgement_required?: boolean;
  maintenance_pending_folio_entry_ids?: string[];
  pending_consumption_count?: number;
  pending_consumption_balance?: number;
  pending_consumption_folio_entry_ids?: string[];
};

export type MaintenanceLocationKind = "area" | "equipment";
export type MaintenanceOccurrenceKind =
  | "damage"
  | "defect"
  | "wear"
  | "safety_risk"
  | "special_cleaning"
  | "preventive"
  | "other";
export type MaintenancePriority = "low" | "normal" | "high" | "critical";
export type MaintenanceOccurrenceStatus =
  | "reported"
  | "triaged"
  | "in_progress"
  | "awaiting_inspection"
  | "awaiting_liability"
  | "resolved"
  | "canceled";
export type MaintenanceWorkOrderStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "paused"
  | "waiting"
  | "awaiting_inspection"
  | "completed"
  | "canceled";
export type MaintenanceWaitingReason =
  "parts" | "vendor" | "authorization" | "access" | "other";
export type MaintenanceLiabilityStatus =
  "not_applicable" | "not_assessed" | "suspected" | "confirmed" | "dismissed";
export type MaintenanceResponsibleParty =
  "guest" | "hotel" | "supplier" | "normal_wear";

export type AdminMaintenanceCategory = {
  id: string;
  hotel_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminMaintenanceLocation = {
  id: string;
  hotel_id: string;
  parent_location_id: string | null;
  parent_name?: string | null;
  kind: MaintenanceLocationKind;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  asset_tag?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  installed_on?: string | null;
  warranty_ends_on?: string | null;
  supplier_id?: string | null;
  contract_id?: string | null;
  lifecycle_status?: "active" | "out_of_service" | "retired" | null;
  created_at: string;
  updated_at: string;
};

export type AdminMaintenanceOccurrenceSummary = {
  id: string;
  occurrence_number: number;
  code: string;
  kind: MaintenanceOccurrenceKind;
  priority: MaintenancePriority;
  status: MaintenanceOccurrenceStatus;
  description: string;
  category_id: string;
  category_name: string;
  room_id: string | null;
  room_number: string | null;
  location_id: string | null;
  location_name: string | null;
  stay_id: string | null;
  reported_by: string;
  reporter_name: string;
  blocking_recommended: boolean;
  liability_status: MaintenanceLiabilityStatus;
  active_block: boolean;
  open_work_orders: number;
  preventive_plan_id?: string | null;
  sla_response_due_at?: string | null;
  sla_resolution_due_at?: string | null;
  operational_resolved_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminMaintenanceWorkOrder = {
  id: string;
  occurrence_id: string;
  title: string;
  instructions: string;
  priority: MaintenancePriority;
  status: MaintenanceWorkOrderStatus;
  assigned_to: string | null;
  assignee_name: string | null;
  due_at: string | null;
  waiting_reason: MaintenanceWaitingReason | null;
  waiting_notes: string | null;
  requires_inspection: boolean;
  diagnosis: string | null;
  resolution_notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  contract_id?: string | null;
  contract_number?: string | null;
  supplier_status?: MaintenanceSupplierWorkStatus;
  supplier_external_reference?: string | null;
  checklist?: AdminMaintenanceChecklistItem[];
  created_at: string;
  updated_at: string;
};

export type AdminMaintenanceInspection = {
  id: string;
  work_order_id: string;
  inspector_id: string;
  inspector_name: string;
  result: "approved" | "rejected";
  notes: string;
  created_at: string;
};

export type AdminMaintenanceEvent = {
  id: string;
  occurrence_id: string;
  work_order_id: string | null;
  actor_id: string;
  actor_name: string;
  event_type: string;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminMaintenanceAttachment = {
  id: string;
  occurrence_id: string;
  work_order_id: string | null;
  original_filename: string;
  content_type: "image/jpeg" | "image/png" | "image/webp";
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
};

export type AdminMaintenanceRoomBlock = {
  id: string;
  occurrence_id: string | null;
  room_id: string;
  room_number: string;
  status: "blocked" | "maintenance";
  label: string | null;
  start_date: string;
  planned_end_date: string;
  released_at: string | null;
  is_overdue: boolean;
};

export type AdminMaintenanceOccurrenceDetail =
  AdminMaintenanceOccurrenceSummary & {
    discovered_at: string;
    triaged_by: string | null;
    triaged_at: string | null;
    suspected_party: MaintenanceResponsibleParty | null;
    confirmed_party: MaintenanceResponsibleParty | null;
    liability_notes: string | null;
    duplicate_of_id: string | null;
    canceled_reason: string | null;
    resolved_at: string | null;
    work_orders: AdminMaintenanceWorkOrder[];
    inspections: AdminMaintenanceInspection[];
    events: AdminMaintenanceEvent[];
    attachments: AdminMaintenanceAttachment[];
    room_blocks: AdminMaintenanceRoomBlock[];
  };

export type AdminMaintenanceOccurrenceCreateInput = {
  category_id: string;
  room_id?: string | null;
  location_id?: string | null;
  stay_id?: string | null;
  kind: MaintenanceOccurrenceKind;
  priority?: MaintenancePriority;
  description: string;
  discovered_at?: string;
  blocking_recommended?: boolean;
};

export type AdminMaintenanceWorkOrderCreateInput = {
  title: string;
  instructions: string;
  priority?: MaintenancePriority;
  assigned_to?: string | null;
  due_at?: string | null;
  requires_inspection?: boolean;
};

export type AdminMaintenanceSummary = {
  open: number;
  assigned_to_me: number;
  unassigned: number;
  overdue: number;
  awaiting_inspection: number;
  blocked_rooms: number;
};

export type AdminMaintenanceReferenceData = {
  categories: AdminMaintenanceCategory[];
  locations: AdminMaintenanceLocation[];
  rooms: Array<{ id: string; room_number: string; room_type: string }>;
  stays: Array<{
    id: string;
    room_id: string;
    reservation_code: string | null;
    customer_name: string | null;
    status: ReservationStatus;
  }>;
  assignable_users: Array<{ id: string; name: string }>;
};

export type AdminMaintenanceOccurrenceListResponse = {
  items: AdminMaintenanceOccurrenceSummary[];
  page: number;
  page_size: number;
  total: number;
};

export type MaintenanceCostKind =
  "material" | "labor" | "external_service" | "other";
export type MaintenanceFinanceApprovalStatus =
  "draft" | "submitted" | "approved" | "rejected" | "canceled";
export type MaintenanceFinanceSettlementStatus =
  "not_posted" | "open" | "partially_settled" | "settled" | "reversed";

export type AdminMaintenanceFinancialSettlement = {
  id: string;
  cost_item_id: string | null;
  recovery_id: string | null;
  financial_transaction_id: string;
  amount: number;
  created_by: string;
  created_at: string;
  reversal_of_id: string | null;
};

export type AdminMaintenanceFinancialAttachment = {
  id: string;
  occurrence_id: string;
  cost_item_id: string | null;
  recovery_id: string | null;
  original_filename: string;
  content_type: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
  removed_at: string | null;
};

export type AdminMaintenanceCostItem = {
  id: string;
  occurrence_id: string;
  occurrence_code?: string;
  work_order_id: string | null;
  kind: MaintenanceCostKind;
  description: string;
  quantity: number;
  estimated_amount: number | null;
  actual_amount: number | null;
  currency: string;
  counterparty: string | null;
  supplier_id?: string | null;
  contract_id?: string | null;
  due_date: string | null;
  reference_code: string | null;
  approval_status: MaintenanceFinanceApprovalStatus;
  settlement_status: MaintenanceFinanceSettlementStatus;
  created_by: string;
  proposer_name?: string;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  decision_reason: string | null;
  settled_amount: number;
  outstanding_amount: number;
  settlements?: AdminMaintenanceFinancialSettlement[];
  attachments?: AdminMaintenanceFinancialAttachment[];
  created_at: string;
  updated_at: string;
};

export type AdminMaintenanceCostItemInput = {
  work_order_id?: string | null;
  kind: MaintenanceCostKind;
  description: string;
  quantity?: number;
  estimated_amount?: number | null;
  actual_amount?: number | null;
  counterparty?: string | null;
  supplier_id?: string | null;
  contract_id?: string | null;
  due_date?: string | null;
  reference_code?: string | null;
};

export type AdminMaintenanceRecovery = {
  id: string;
  occurrence_id: string;
  occurrence_code?: string;
  responsible_party: "guest" | "supplier";
  stay_id: string | null;
  debtor_name: string | null;
  supplier_id?: string | null;
  contract_id?: string | null;
  charge_amount: number;
  waived_amount: number;
  currency: string;
  justification: string;
  due_date: string | null;
  approval_status: MaintenanceFinanceApprovalStatus;
  settlement_status: MaintenanceFinanceSettlementStatus;
  folio_entry_id: string | null;
  created_by: string;
  proposer_name?: string;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  decision_reason: string | null;
  settled_amount: number;
  outstanding_amount: number;
  settlements?: AdminMaintenanceFinancialSettlement[];
  attachments?: AdminMaintenanceFinancialAttachment[];
  created_at: string;
  updated_at: string;
};

export type AdminMaintenanceRecoveryInput = {
  responsible_party: "guest" | "supplier";
  stay_id?: string | null;
  debtor_name?: string | null;
  supplier_id?: string | null;
  contract_id?: string | null;
  charge_amount: number;
  waived_amount?: number;
  justification: string;
  due_date?: string | null;
};

export type AdminMaintenanceFinanceOccurrence = {
  occurrence_id: string;
  currency: string;
  estimated_cost: number;
  approved_cost: number;
  settled_cost: number;
  approved_recovery: number;
  received_recovery: number;
  net_result: number;
  cost_items: AdminMaintenanceCostItem[];
  recoveries: AdminMaintenanceRecovery[];
};

export type AdminMaintenanceFinanceSummary = {
  currency: string;
  awaiting_approval: number;
  payable: number;
  receivable: number;
  overdue: number;
  settled: number;
  payable_amount: number;
  receivable_amount: number;
};

export type AdminMaintenanceFinanceListResponse = {
  items: Array<AdminMaintenanceCostItem | AdminMaintenanceRecovery>;
  page: number;
  page_size: number;
  total: number;
};

export type MaintenanceRecurrenceUnit =
  "daily" | "weekly" | "monthly" | "yearly";
export type MaintenancePreventivePlanStatus = "active" | "paused" | "inactive";
export type MaintenancePreventiveRunStatus =
  "scheduled" | "generated" | "deferred" | "skipped" | "rescheduled";
export type MaintenanceSupplierWorkStatus =
  "not_sent" | "sent" | "accepted" | "in_service" | "completed" | "canceled";

export type AdminMaintenanceChecklistItem = {
  id: string;
  work_order_id: string;
  position: number;
  description: string;
  is_required: boolean;
  completed_by: string | null;
  completed_at: string | null;
  completion_notes: string | null;
};

export type AdminMaintenanceSlaPolicy = {
  id: string;
  hotel_id: string;
  category_id: string | null;
  category_name?: string | null;
  priority: MaintenancePriority;
  name: string;
  response_hours: number;
  resolution_hours: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminMaintenancePreventiveTaskInput = {
  id?: string;
  position: number;
  description: string;
  is_required?: boolean;
};

export type AdminMaintenancePreventivePlanInput = {
  name: string;
  category_id: string;
  room_id?: string | null;
  location_id?: string | null;
  assigned_to: string;
  supplier_id?: string | null;
  contract_id?: string | null;
  priority?: MaintenancePriority;
  instructions: string;
  requires_inspection?: boolean;
  blocking_recommended?: boolean;
  recurrence_unit: MaintenanceRecurrenceUnit;
  recurrence_interval?: number;
  starts_on: string;
  ends_on?: string | null;
  local_time: string;
  generation_lead_days?: number;
  completion_due_hours?: number;
  tasks: AdminMaintenancePreventiveTaskInput[];
};

export type AdminMaintenancePreventivePlan =
  AdminMaintenancePreventivePlanInput & {
    id: string;
    hotel_id: string;
    recurrence_interval: number;
    recurrence_day: number;
    generation_lead_days: number;
    completion_due_hours: number;
    next_due_date: string;
    status: MaintenancePreventivePlanStatus;
    category_name?: string;
    target_name?: string;
    assignee_name?: string;
    supplier_name?: string | null;
    contract_number?: string | null;
    created_at: string;
    updated_at: string;
  };

export type AdminMaintenancePreventiveRun = {
  id: string;
  plan_id: string;
  scheduled_for: string;
  scheduled_local_date: string;
  status: MaintenancePreventiveRunStatus;
  occurrence_id: string | null;
  work_order_id: string | null;
  snapshot: Record<string, unknown>;
  decision_reason: string | null;
  rescheduled_for: string | null;
  created_at: string;
};

export type AdminMaintenanceSupplierContact = {
  id: string;
  supplier_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_active: boolean;
};

export type AdminMaintenanceContract = {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  contract_number: string;
  kind: "fixed" | "per_service" | "warranty" | "other";
  status: "draft" | "active" | "expired" | "terminated";
  starts_on: string;
  ends_on: string | null;
  renewal_notice_on: string | null;
  scope_notes: string | null;
  response_hours: number | null;
  resolution_hours: number | null;
  commercial_terms?: string | null;
  contract_amount?: number | null;
  currency?: string | null;
  category_ids?: string[];
  location_ids?: string[];
  documents?: Array<{
    id: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
};

export type AdminMaintenanceSupplier = {
  id: string;
  hotel_id: string;
  name: string;
  legal_name: string | null;
  tax_document: string | null;
  email: string | null;
  phone: string | null;
  specialties: string[];
  notes: string | null;
  status: "active" | "inactive";
  contacts?: AdminMaintenanceSupplierContact[];
  contracts?: AdminMaintenanceContract[];
  documents?: Array<{
    id: string;
    original_filename: string;
    content_type: string;
    size_bytes: number;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
};

export type AdminMaintenanceNotification = {
  id: string;
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  href: string;
  entity_type: string;
  entity_id: string;
  status: "unread" | "read" | "dismissed";
  created_at: string;
};

export type AdminMaintenanceAnalytics = {
  filters: Record<string, string | undefined>;
  backlog: number;
  critical_open: number;
  average_triage_hours: number;
  average_resolution_hours: number;
  sla_compliance_rate: number;
  preventive_compliance_rate: number;
  recurring_occurrences: number;
  blocked_room_days: number;
  supplier_completion_rate: number;
  aging: Array<{ bucket: string; count: number }>;
  series: Array<{ date: string; opened: number; resolved: number }>;
  financial?: {
    approved_cost: number;
    approved_recovery: number;
    net_result: number;
    currency: string;
  };
};

export type AdminMaintenanceAutomationRun = {
  id: string;
  run_key: string;
  status: "running" | "completed" | "failed";
  trigger_kind: string;
  local_date: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  counters: Record<string, unknown>;
  error_message: string | null;
};
