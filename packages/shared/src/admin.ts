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

export type AdminProduct = {
  id: string;
  hotel_id: string;
  name: string;
  category: string | null;
  unit_price: number;
  status: ProductStatus;
  created_at?: string;
  updated_at?: string;
};

export type AdminProductCreateInput = {
  name: string;
  category?: string | null;
  unit_price: number;
  status?: ProductStatus;
};

export type AdminProductUpdateInput = Partial<AdminProductCreateInput>;

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
  "lodging" | "maintenance_charge" | "payment" | "refund" | "adjustment";

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
};

export type MaintenanceLocationKind = "area" | "equipment";
export type MaintenanceOccurrenceKind =
  "damage" | "defect" | "wear" | "safety_risk" | "special_cleaning" | "other";
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
