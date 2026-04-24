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
  SELF_ACTION_FORBIDDEN: "ADMIN_SELF_ACTION_FORBIDDEN"
} as const;

export type AdminErrorCode = (typeof ADMIN_ERROR_CODE)[keyof typeof ADMIN_ERROR_CODE];

export type AdminErrorResponse = {
  code: AdminErrorCode;
  message: string;
  details?: string;
};

export const ADMIN_PERMISSION_TYPES = {
  SYSTEM: "SYSTEM_PERMISSION",
  HOTEL: "HOTEL_PERMISSION"
} as const;

export type AdminPermissionType = (typeof ADMIN_PERMISSION_TYPES)[keyof typeof ADMIN_PERMISSION_TYPES];

export const ADMIN_ROLE_TYPES = {
  SYSTEM: "SYSTEM_ROLE",
  HOTEL: "HOTEL_ROLE"
} as const;

export type AdminRoleType = (typeof ADMIN_ROLE_TYPES)[keyof typeof ADMIN_ROLE_TYPES];

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

export type ReservationStatus = "pending" | "confirmed" | "checked_in" | "checked_out" | "canceled" | "no_show";
export type ReservationSource = "front_desk" | "website" | "phone" | "agency";
export type ReservationPaymentStatus = "pending" | "partial" | "paid" | "refunded";

export type AdminReservation = {
  id: string;
  hotel_id: string;
  booking_customer_id: string;
  reservation_code: string;
  planned_checkin_date: string;
  planned_checkout_date: string;
  actual_checkin_date: string | null;
  actual_checkout_date: string | null;
  guest_count: number;
  reservation_status: ReservationStatus;
  reservation_source: ReservationSource | null;
  payment_status: ReservationPaymentStatus;
  estimated_total_amount: number | null;
  final_total_amount: number | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminReservationCreateInput = {
  booking_customer_id: string;
  reservation_code: string;
  planned_checkin_date: string;
  planned_checkout_date: string;
  actual_checkin_date?: string | null;
  actual_checkout_date?: string | null;
  guest_count: number;
  reservation_status?: ReservationStatus;
  reservation_source?: ReservationSource | null;
  payment_status?: ReservationPaymentStatus;
  estimated_total_amount?: number | null;
  final_total_amount?: number | null;
  notes?: string | null;
};

export type AdminReservationUpdateInput = Partial<AdminReservationCreateInput>;

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

export type AdminSeasonRoomRateUpdateInput = Partial<AdminSeasonRoomRateCreateInput>;
