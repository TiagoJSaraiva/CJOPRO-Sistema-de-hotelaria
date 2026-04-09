export type AdminListResponse<T> = {
  items: T[];
};

export type AdminItemResponse<T> = {
  item: T;
};

export type AdminOkResponse = {
  ok: boolean;
};

export type AdminErrorResponse = {
  message?: string;
};

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
  hotel_id: string | null;
  hotel_name: string | null;
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
};

export type AdminRole = {
  id: string;
  name: string;
  hotel_id: string | null;
  hotel_name: string | null;
  permissions: AdminRolePermission[];
};

export type AdminRoleOption = {
  id: string;
  name: string;
  hotel_id: string | null;
  hotel_name: string | null;
};

export type AdminRoleCreateInput = {
  name: string;
  hotel_id: string | null;
  permission_ids: string[];
};

export type AdminRoleUpdateInput = {
  name?: string;
  hotel_id?: string | null;
  permission_ids?: string[];
};

export type AdminPermission = {
  id: string;
  name: string;
};

export type AdminPermissionOption = {
  id: string;
  name: string;
};

export type AdminPermissionCreateInput = {
  name: string;
};

export type AdminPermissionUpdateInput = {
  name?: string;
};

export type AdminUsersReferenceData = {
  hotels: AdminHotelOption[];
  roles: AdminRoleOption[];
};

export type AdminRolesReferenceData = {
  hotels: AdminHotelOption[];
  permissions: AdminPermissionOption[];
};
