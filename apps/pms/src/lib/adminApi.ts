import { cookies } from "next/headers";
import {
  ACTIVE_HOTEL_GLOBAL_VALUE,
  ACTIVE_HOTEL_HEADER_NAME,
  AdminErrorResponse,
  AdminHotel,
  AdminHotelCreateInput,
  AdminHotelUpdateInput,
  AdminItemResponse,
  AdminListResponse,
  AdminPermission,
  AdminPermissionCreateInput,
  AdminPermissionUpdateInput,
  AdminProduct,
  AdminProductCategory,
  AdminProductCategoryInput,
  AdminCatalogAuditEvent,
  AdminConsumptionConfigurationAuditEvent,
  AdminConsumptionOffer,
  AdminConsumptionOfferBatchInput,
  AdminConsumptionOfferUpdateInput,
  AdminConsumptionPoint,
  AdminConsumptionPointInput,
  AdminConsumptionReorderInput,
  AdminConsumptionEligibleStay,
  AdminConsumptionOperationalContext,
  AdminConsumptionOrder,
  AdminConsumptionOrderCreateInput,
  AdminConsumptionOrderHistory,
  AdminCommercialPartner,
  AdminCommercialPartnerInput,
  AdminCommercialPartnerContact,
  AdminCommercialPartnerContactInput,
  AdminCommercialAgreement,
  AdminCommercialAgreementCreateInput,
  AdminCommercialAgreementRevision,
  AdminCommercialAgreementRevisionInput,
  AdminCommercialAgreementEligibility,
  AdminCommercialAuditEvent,
  AdminProductCreateInput,
  AdminProductUpdateInput,
  AdminFinancialTransaction,
  AdminFinancialTransactionCreateInput,
  AdminFinancialTransactionUpdateInput,
  AdminReservationCalendarResponse,
  AdminReservationCalendarBookingCreateInput,
  AdminReservationCalendarBookingCreateResponse,
  AdminStayOperationalPanelResponse,
  AdminStayFolioAllocationPreview,
  AdminStayAccount,
  AdminStayPaymentBatchInput,
  AdminStayRefundInput,
  AdminStayCheckoutInput,
  AdminStayCheckoutRecord,
  AdminConsumptionCorrection,
  AdminConsumptionCorrectionCreateInput,
  AdminConsumptionCorrectionDecisionInput,
  AdminPartnerRefundConfirmationInput,
  AdminStayPaymentCreateInput,
  AdminRoom,
  AdminRoomCreateInput,
  AdminRoomUpdateInput,
  AdminRolesReferenceData,
  AdminRole,
  AdminRoleCreateInput,
  AdminRoleUpdateInput,
  AdminSeason,
  AdminSeasonCreateInput,
  AdminSeasonRoomRate,
  AdminSeasonRoomRateCreateInput,
  AdminSeasonRoomRateUpdateInput,
  AdminSeasonUpdateInput,
  AdminCustomer,
  AdminCustomerCreateInput,
  AdminCustomerUpdateInput,
  AdminUser,
  AdminUserCreateInput,
  AdminUserUpdateInput,
  AdminUsersReferenceData,
  AdminMaintenanceOccurrenceListResponse,
  AdminMaintenanceOccurrenceDetail,
  AdminMaintenanceReferenceData,
  AdminMaintenanceSummary,
  AdminMaintenanceFinanceListResponse,
  AdminMaintenanceFinanceOccurrence,
  AdminMaintenanceFinanceSummary,
  AdminStayFolioResponse,
  AdminMaintenancePreventivePlan,
  AdminMaintenancePreventiveRun,
  AdminMaintenanceSupplier,
  AdminMaintenanceSlaPolicy,
  AdminMaintenanceNotification,
  AdminMaintenanceAnalytics,
  AdminMaintenanceAutomationRun,
} from "@hotel/shared";
import { getActiveHotelCookieValue } from "./activeHotel";

const SESSION_COOKIE_NAME = "pms_session_token";
const DEFAULT_BACKEND_URL = "http://localhost:3334";

function getBackendUrl(): string {
  return process.env.BACKEND_SERVICE_URL || DEFAULT_BACKEND_URL;
}

async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

async function getActiveHotelHeaderValue(): Promise<string | null> {
  const preferredHotelId = await getActiveHotelCookieValue();

  if (preferredHotelId === undefined) {
    return null;
  }

  return preferredHotelId || ACTIVE_HOTEL_GLOBAL_VALUE;
}

async function getAdminList<T>(path: string): Promise<T[]> {
  const token = await getSessionToken();

  if (!token) {
    return [];
  }

  const activeHotelHeaderValue = await getActiveHotelHeaderValue();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (activeHotelHeaderValue !== null) {
    headers[ACTIVE_HOTEL_HEADER_NAME] = activeHotelHeaderValue;
  }

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: "GET",
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as AdminListResponse<T>;
  return payload.items || [];
}

async function requestAdmin<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T | null> {
  const token = await getSessionToken();

  if (!token) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

  const hasBody = body !== undefined;
  const activeHotelHeaderValue = await getActiveHotelHeaderValue();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (activeHotelHeaderValue !== null) {
    headers[ACTIVE_HOTEL_HEADER_NAME] = activeHotelHeaderValue;
  }

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method,
    cache: "no-store",
    headers,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as AdminErrorResponse;
    console.error("[adminApi] Request failed", {
      method,
      path,
      status: response.status,
      statusText: response.statusText,
      error: payload,
      requestBody: hasBody ? body : undefined,
      backendUrl: getBackendUrl(),
    });
    const error = new Error(
      payload.message || "Falha na operação administrativa.",
    ) as Error & {
      statusCode?: number;
      details?: string;
    };
    error.statusCode = response.status;
    error.details = payload.details;
    throw error;
  }

  if (method === "DELETE") {
    return null;
  }

  const payload = (await response.json()) as AdminItemResponse<T>;
  return payload.item;
}

async function requestAdminItems<T>(
  path: string,
  method: "POST" | "PUT",
  body: unknown,
): Promise<T[]> {
  const token = await getSessionToken();
  if (!token) throw new Error("Sessão inválida. Faça login novamente.");
  const activeHotelHeaderValue = await getActiveHotelHeaderValue();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (activeHotelHeaderValue !== null)
    headers[ACTIVE_HOTEL_HEADER_NAME] = activeHotelHeaderValue;
  const response = await fetch(`${getBackendUrl()}${path}`, {
    method,
    cache: "no-store",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as AdminErrorResponse;
    throw new Error(payload.message || "Falha na operação administrativa.");
  }
  const payload = (await response.json()) as AdminListResponse<T>;
  return payload.items || [];
}

async function requestAdminOk(
  path: string,
  method: "POST" | "PUT",
  body: unknown,
): Promise<boolean> {
  const token = await getSessionToken();
  if (!token) throw new Error("Sessão inválida. Faça login novamente.");
  const activeHotelHeaderValue = await getActiveHotelHeaderValue();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (activeHotelHeaderValue !== null)
    headers[ACTIVE_HOTEL_HEADER_NAME] = activeHotelHeaderValue;
  const response = await fetch(`${getBackendUrl()}${path}`, {
    method,
    cache: "no-store",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as AdminErrorResponse;
    throw new Error(payload.message || "Falha na operação administrativa.");
  }
  const payload = (await response.json()) as { ok?: boolean };
  return payload.ok === true;
}

async function getAdminData<T>(path: string): Promise<T> {
  const token = await getSessionToken();

  if (!token) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

  const activeHotelHeaderValue = await getActiveHotelHeaderValue();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (activeHotelHeaderValue !== null) {
    headers[ACTIVE_HOTEL_HEADER_NAME] = activeHotelHeaderValue;
  }

  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: "GET",
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as AdminErrorResponse;
    const error = new Error(
      payload.message || "Falha na consulta administrativa.",
    ) as Error & { statusCode?: number };
    error.statusCode = response.status;
    throw error;
  }

  return (await response.json()) as T;
}

export type {
  AdminCustomer,
  AdminCustomerCreateInput,
  AdminCustomerUpdateInput,
  AdminErrorResponse,
  AdminHotel,
  AdminHotelCreateInput,
  AdminHotelUpdateInput,
  AdminPermission,
  AdminPermissionCreateInput,
  AdminPermissionUpdateInput,
  AdminProduct,
  AdminProductCreateInput,
  AdminProductUpdateInput,
  AdminFinancialTransaction,
  AdminFinancialTransactionCreateInput,
  AdminFinancialTransactionUpdateInput,
  AdminReservationCalendarResponse,
  AdminReservationCalendarBookingCreateInput,
  AdminReservationCalendarBookingCreateResponse,
  AdminStayOperationalPanelResponse,
  AdminStayPaymentCreateInput,
  AdminRoom,
  AdminRoomCreateInput,
  AdminRoomUpdateInput,
  AdminRolesReferenceData,
  AdminRole,
  AdminRoleCreateInput,
  AdminRoleUpdateInput,
  AdminSeason,
  AdminSeasonCreateInput,
  AdminSeasonRoomRate,
  AdminSeasonRoomRateCreateInput,
  AdminSeasonRoomRateUpdateInput,
  AdminSeasonUpdateInput,
  AdminUser,
  AdminUserCreateInput,
  AdminUserUpdateInput,
  AdminUsersReferenceData,
} from "@hotel/shared";

export function listHotels(): Promise<AdminHotel[]> {
  return getAdminList<AdminHotel>("/admin/hotels");
}

export function createHotel(
  payload: AdminHotelCreateInput,
): Promise<AdminHotel | null> {
  return requestAdmin<AdminHotel>("/admin/hotels", "POST", payload);
}

export function updateHotel(
  id: string,
  payload: AdminHotelUpdateInput,
): Promise<AdminHotel | null> {
  return requestAdmin<AdminHotel>(`/admin/hotels/${id}`, "PUT", payload);
}

export function deleteHotel(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/hotels/${id}`, "DELETE");
}

export function listUsers(): Promise<AdminUser[]> {
  return getAdminList<AdminUser>("/admin/users");
}

export function getUsersReferenceData(): Promise<AdminUsersReferenceData> {
  return getAdminData<AdminUsersReferenceData>("/admin/users/reference-data");
}

export function createUser(
  payload: AdminUserCreateInput,
): Promise<AdminUser | null> {
  return requestAdmin<AdminUser>("/admin/users", "POST", payload);
}

export function updateUser(
  id: string,
  payload: AdminUserUpdateInput,
): Promise<AdminUser | null> {
  return requestAdmin<AdminUser>(`/admin/users/${id}`, "PUT", payload);
}

export function deleteUser(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/users/${id}`, "DELETE");
}

export function listRoles(): Promise<AdminRole[]> {
  return getAdminList<AdminRole>("/admin/roles");
}

export function getRolesReferenceData(): Promise<AdminRolesReferenceData> {
  return getAdminData<AdminRolesReferenceData>("/admin/roles/reference-data");
}

export function createRole(
  payload: AdminRoleCreateInput,
): Promise<AdminRole | null> {
  return requestAdmin<AdminRole>("/admin/roles", "POST", payload);
}

export function updateRole(
  id: string,
  payload: AdminRoleUpdateInput,
): Promise<AdminRole | null> {
  return requestAdmin<AdminRole>(`/admin/roles/${id}`, "PUT", payload);
}

export function deleteRole(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/roles/${id}`, "DELETE");
}

export function listPermissions(): Promise<AdminPermission[]> {
  return getAdminList<AdminPermission>("/admin/permissions");
}

export function createPermission(
  payload: AdminPermissionCreateInput,
): Promise<AdminPermission | null> {
  return requestAdmin<AdminPermission>("/admin/permissions", "POST", payload);
}

export function updatePermission(
  id: string,
  payload: AdminPermissionUpdateInput,
): Promise<AdminPermission | null> {
  return requestAdmin<AdminPermission>(
    `/admin/permissions/${id}`,
    "PUT",
    payload,
  );
}

export function deletePermission(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/permissions/${id}`, "DELETE");
}

export function listRooms(): Promise<AdminRoom[]> {
  return getAdminList<AdminRoom>("/admin/rooms");
}

export function createRoom(
  payload: AdminRoomCreateInput,
): Promise<AdminRoom | null> {
  return requestAdmin<AdminRoom>("/admin/rooms", "POST", payload);
}

export function updateRoom(
  id: string,
  payload: AdminRoomUpdateInput,
): Promise<AdminRoom | null> {
  return requestAdmin<AdminRoom>(`/admin/rooms/${id}`, "PUT", payload);
}

export function deleteRoom(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/rooms/${id}`, "DELETE");
}

export function listCustomers(): Promise<AdminCustomer[]> {
  return getAdminList<AdminCustomer>("/admin/customers");
}

export function createCustomer(
  payload: AdminCustomerCreateInput,
): Promise<AdminCustomer | null> {
  return requestAdmin<AdminCustomer>("/admin/customers", "POST", payload);
}

export function updateCustomer(
  id: string,
  payload: AdminCustomerUpdateInput,
): Promise<AdminCustomer | null> {
  return requestAdmin<AdminCustomer>(`/admin/customers/${id}`, "PUT", payload);
}

export function deleteCustomer(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/customers/${id}`, "DELETE");
}

export function getReservationsCalendar(
  startDate: string,
  days = 20,
): Promise<AdminReservationCalendarResponse> {
  const query = new URLSearchParams({
    start_date: startDate,
    days: String(days),
  });
  return getAdminData<AdminReservationCalendarResponse>(
    `/admin/reservations/calendar?${query.toString()}`,
  );
}

export async function requestMaintenanceEndpoint<T>(
  path: string,
  method: "GET" | "POST" | "PUT",
  body?: unknown,
): Promise<T> {
  const token = await getSessionToken();
  if (!token) throw new Error("Sessão inválida. Faça login novamente.");
  const activeHotelHeaderValue = await getActiveHotelHeaderValue();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (activeHotelHeaderValue !== null)
    headers[ACTIVE_HOTEL_HEADER_NAME] = activeHotelHeaderValue;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(
    `${getBackendUrl()}/admin/maintenance/${path.replace(/^\/+/, "")}`,
    {
      method,
      cache: "no-store",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as T &
    AdminErrorResponse;
  if (!response.ok) {
    const error = new Error(
      payload.message || "Falha na operação de manutenção.",
    ) as Error & { statusCode?: number; details?: string };
    error.statusCode = response.status;
    error.details = payload.details;
    throw error;
  }
  return payload;
}

export function getMaintenanceOccurrences(
  query = "",
): Promise<AdminMaintenanceOccurrenceListResponse> {
  return requestMaintenanceEndpoint<AdminMaintenanceOccurrenceListResponse>(
    `occurrences${query ? `?${query}` : ""}`,
    "GET",
  );
}

export async function getMaintenanceOccurrence(
  id: string,
): Promise<AdminMaintenanceOccurrenceDetail> {
  const response = await requestMaintenanceEndpoint<
    AdminItemResponse<AdminMaintenanceOccurrenceDetail>
  >(`occurrences/${id}`, "GET");
  return response.item;
}

export function getMaintenanceReferenceData(): Promise<AdminMaintenanceReferenceData> {
  return requestMaintenanceEndpoint<AdminMaintenanceReferenceData>(
    "reference-data",
    "GET",
  );
}

export function getMaintenanceSummary(): Promise<AdminMaintenanceSummary> {
  return requestMaintenanceEndpoint<AdminMaintenanceSummary>("summary", "GET");
}

export function getMaintenanceFinanceSummary(): Promise<AdminMaintenanceFinanceSummary> {
  return requestMaintenanceEndpoint<AdminMaintenanceFinanceSummary>(
    "finance/summary",
    "GET",
  );
}

export function getMaintenanceFinanceItems(
  query = "",
): Promise<AdminMaintenanceFinanceListResponse> {
  return requestMaintenanceEndpoint<AdminMaintenanceFinanceListResponse>(
    `finance/items${query ? `?${query}` : ""}`,
    "GET",
  );
}

export async function getMaintenanceOccurrenceFinance(
  id: string,
): Promise<AdminMaintenanceFinanceOccurrence> {
  const response = await requestMaintenanceEndpoint<
    AdminItemResponse<AdminMaintenanceFinanceOccurrence>
  >(`occurrences/${id}/finance`, "GET");
  return response.item;
}

export function getMaintenancePreventivePlans(): Promise<
  AdminMaintenancePreventivePlan[]
> {
  return requestMaintenanceEndpoint<{
    items: AdminMaintenancePreventivePlan[];
  }>("preventive-plans", "GET").then((response) => response.items);
}

export function getMaintenancePreventiveRuns(
  planId: string,
): Promise<AdminMaintenancePreventiveRun[]> {
  return requestMaintenanceEndpoint<{ items: AdminMaintenancePreventiveRun[] }>(
    `preventive-plans/${planId}/runs`,
    "GET",
  ).then((response) => response.items);
}

export function getMaintenanceSuppliers(): Promise<AdminMaintenanceSupplier[]> {
  return requestMaintenanceEndpoint<{ items: AdminMaintenanceSupplier[] }>(
    "suppliers",
    "GET",
  ).then((response) => response.items);
}

export function getMaintenanceSlaPolicies(): Promise<
  AdminMaintenanceSlaPolicy[]
> {
  return requestMaintenanceEndpoint<{ items: AdminMaintenanceSlaPolicy[] }>(
    "sla-policies",
    "GET",
  ).then((response) => response.items);
}

export function getMaintenanceNotifications(
  query = "",
): Promise<AdminMaintenanceNotification[]> {
  return requestMaintenanceEndpoint<{ items: AdminMaintenanceNotification[] }>(
    `notifications${query ? `?${query}` : ""}`,
    "GET",
  ).then((response) => response.items);
}

export function getMaintenanceNotificationSummary(): Promise<{
  unread: number;
}> {
  return requestMaintenanceEndpoint<{ unread: number }>(
    "notifications/summary",
    "GET",
  );
}

export function getMaintenanceAnalytics(
  query = "",
): Promise<AdminMaintenanceAnalytics> {
  return requestMaintenanceEndpoint<AdminMaintenanceAnalytics>(
    `analytics${query ? `?${query}` : ""}`,
    "GET",
  );
}

export function getMaintenanceAnalyticsRows(
  query = "",
): Promise<Array<Record<string, unknown>>> {
  return requestMaintenanceEndpoint<{ items: Array<Record<string, unknown>> }>(
    `analytics/export-data${query ? `?${query}` : ""}`,
    "GET",
  ).then((response) => response.items);
}

export function getMaintenanceAutomationRuns(): Promise<
  AdminMaintenanceAutomationRun[]
> {
  return requestMaintenanceEndpoint<{ items: AdminMaintenanceAutomationRun[] }>(
    "automation-runs",
    "GET",
  ).then((response) => response.items);
}

export function simulateReservationsCalendarBooking(
  payload: AdminReservationCalendarBookingCreateInput,
): Promise<AdminReservationCalendarBookingCreateResponse> {
  return requestAdmin<AdminReservationCalendarBookingCreateResponse>(
    "/admin/reservations/calendar/booking/simulate",
    "POST",
    payload,
  ).then((result) => result as AdminReservationCalendarBookingCreateResponse);
}

export function createReservationsCalendarBooking(
  payload: AdminReservationCalendarBookingCreateInput,
): Promise<AdminReservationCalendarBookingCreateResponse | null> {
  return requestAdmin<AdminReservationCalendarBookingCreateResponse>(
    "/admin/reservations/calendar/booking",
    "POST",
    payload,
  );
}

export async function getStayOperationalPanel(
  stayId: string,
): Promise<AdminStayOperationalPanelResponse> {
  const response = await getAdminData<
    AdminItemResponse<AdminStayOperationalPanelResponse>
  >(`/admin/stays/${stayId}/panel`);
  return response.item;
}

export async function getStayFolio(
  stayId: string,
): Promise<AdminStayFolioResponse> {
  const response = await getAdminData<
    AdminItemResponse<AdminStayFolioResponse>
  >(`/admin/stays/${stayId}/folio`);
  return response.item;
}

export async function getStayAccount(
  stayId: string,
): Promise<AdminStayAccount> {
  const response = await getAdminData<AdminItemResponse<AdminStayAccount>>(
    `/admin/stays/${stayId}/account`,
  );
  return response.item;
}

export function createStayPaymentBatch(
  stayId: string,
  payload: AdminStayPaymentBatchInput,
): Promise<AdminStayAccount | null> {
  return requestAdmin<AdminStayAccount>(
    `/admin/stays/${stayId}/payment-batches`,
    "POST",
    payload,
  );
}

export function createStayRefund(
  stayId: string,
  payload: AdminStayRefundInput,
): Promise<AdminStayAccount | null> {
  return requestAdmin<AdminStayAccount>(
    `/admin/stays/${stayId}/refunds`,
    "POST",
    payload,
  );
}

export async function getStayCheckoutRecord(
  stayId: string,
): Promise<AdminStayCheckoutRecord> {
  const response = await getAdminData<
    AdminItemResponse<AdminStayCheckoutRecord>
  >(`/admin/stays/${stayId}/checkout-record`);
  return response.item;
}

export async function previewStayPaymentAllocation(
  stayId: string,
  amount: number,
): Promise<AdminStayFolioAllocationPreview> {
  const response = await requestAdmin<AdminStayFolioAllocationPreview>(
    `/admin/stays/${stayId}/payments/allocation-preview`,
    "POST",
    { amount },
  );
  if (!response) throw new Error("Falha ao sugerir a alocação do pagamento.");
  return response;
}

export async function getStayCheckoutCandidateByRoomNumber(
  roomNumber: string,
): Promise<AdminStayOperationalPanelResponse> {
  const query = new URLSearchParams({
    room_number: roomNumber,
  });
  const response = await getAdminData<
    AdminItemResponse<AdminStayOperationalPanelResponse>
  >(`/admin/stays/checkout-candidate?${query.toString()}`);
  return response.item;
}

export function createStayPayment(
  stayId: string,
  payload: AdminStayPaymentCreateInput,
): Promise<AdminStayOperationalPanelResponse | null> {
  return requestAdmin<AdminStayOperationalPanelResponse>(
    `/admin/stays/${stayId}/payments`,
    "POST",
    payload,
  );
}

export function executeStayCheckin(
  stayId: string,
): Promise<AdminStayOperationalPanelResponse | null> {
  return requestAdmin<AdminStayOperationalPanelResponse>(
    `/admin/stays/${stayId}/checkin`,
    "POST",
    {},
  );
}

export function executeStayCheckout(
  stayId: string,
  payload: AdminStayCheckoutInput,
): Promise<AdminStayAccount | null> {
  return requestAdmin<AdminStayAccount>(
    `/admin/stays/${stayId}/checkout`,
    "POST",
    payload,
  );
}

export function requestConsumptionCorrection(
  orderId: string,
  payload: AdminConsumptionCorrectionCreateInput,
): Promise<AdminConsumptionCorrection | null> {
  return requestAdmin<AdminConsumptionCorrection>(
    `/admin/consumption-orders/${orderId}/corrections`,
    "POST",
    payload,
  );
}

export async function listConsumptionCorrections(
  query = "",
): Promise<AdminConsumptionCorrection[]> {
  return getAdminList<AdminConsumptionCorrection>(
    `/admin/consumption-corrections${query ? `?${query}` : ""}`,
  );
}

export function decideConsumptionCorrection(
  correctionId: string,
  payload: AdminConsumptionCorrectionDecisionInput,
): Promise<AdminConsumptionCorrection | null> {
  return requestAdmin<AdminConsumptionCorrection>(
    `/admin/consumption-corrections/${correctionId}/decision`,
    "POST",
    payload,
  );
}

export function confirmPartnerCorrectionRefund(
  correctionId: string,
  payload: AdminPartnerRefundConfirmationInput,
): Promise<AdminConsumptionCorrection | null> {
  return requestAdmin<AdminConsumptionCorrection>(
    `/admin/consumption-corrections/${correctionId}/partner-refund-confirmation`,
    "POST",
    payload,
  );
}

export function executeStayNoShow(
  stayId: string,
): Promise<AdminStayOperationalPanelResponse | null> {
  return requestAdmin<AdminStayOperationalPanelResponse>(
    `/admin/stays/${stayId}/no-show`,
    "POST",
    {},
  );
}

export function executeStayCancel(
  stayId: string,
): Promise<AdminStayOperationalPanelResponse | null> {
  return requestAdmin<AdminStayOperationalPanelResponse>(
    `/admin/stays/${stayId}/cancel`,
    "POST",
    {},
  );
}

export function listFinancialTransactions(): Promise<
  AdminFinancialTransaction[]
> {
  return getAdminList<AdminFinancialTransaction>(
    "/admin/financial-transactions",
  );
}

export function createFinancialTransaction(
  payload: AdminFinancialTransactionCreateInput,
): Promise<AdminFinancialTransaction | null> {
  return requestAdmin<AdminFinancialTransaction>(
    "/admin/financial-transactions",
    "POST",
    payload,
  );
}

export function updateFinancialTransaction(
  id: string,
  payload: AdminFinancialTransactionUpdateInput,
): Promise<AdminFinancialTransaction | null> {
  return requestAdmin<AdminFinancialTransaction>(
    `/admin/financial-transactions/${id}`,
    "PUT",
    payload,
  );
}

export function deleteFinancialTransaction(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/financial-transactions/${id}`, "DELETE");
}

export function listProducts(includeArchived = false): Promise<AdminProduct[]> {
  return getAdminList<AdminProduct>(
    `/admin/products${includeArchived ? "?include_archived=true" : ""}`,
  );
}

export function listProductCategories(
  includeArchived = false,
): Promise<AdminProductCategory[]> {
  return getAdminList<AdminProductCategory>(
    `/admin/product-categories${includeArchived ? "?include_archived=true" : ""}`,
  );
}

export function createProductCategory(
  payload: AdminProductCategoryInput,
): Promise<AdminProductCategory | null> {
  return requestAdmin<AdminProductCategory>(
    "/admin/product-categories",
    "POST",
    payload,
  );
}

export function updateProductCategory(
  id: string,
  payload: Partial<AdminProductCategoryInput>,
): Promise<AdminProductCategory | null> {
  return requestAdmin<AdminProductCategory>(
    `/admin/product-categories/${id}`,
    "PUT",
    payload,
  );
}

export function archiveProductCategory(
  id: string,
  archived: boolean,
): Promise<AdminProductCategory | null> {
  return requestAdmin<AdminProductCategory>(
    `/admin/product-categories/${id}/${archived ? "archive" : "restore"}`,
    "POST",
  );
}

export function createProduct(
  payload: AdminProductCreateInput,
): Promise<AdminProduct | null> {
  return requestAdmin<AdminProduct>("/admin/products", "POST", payload);
}

export function updateProduct(
  id: string,
  payload: AdminProductUpdateInput,
): Promise<AdminProduct | null> {
  return requestAdmin<AdminProduct>(`/admin/products/${id}`, "PUT", payload);
}

export function setProductArchived(
  id: string,
  archived: boolean,
): Promise<AdminProduct | null> {
  return requestAdmin<AdminProduct>(
    `/admin/products/${id}/${archived ? "archive" : "restore"}`,
    "POST",
  );
}

export function listProductHistory(
  id: string,
): Promise<AdminCatalogAuditEvent[]> {
  return getAdminList<AdminCatalogAuditEvent>(`/admin/products/${id}/history`);
}

export function listCommercialPartners(
  includeArchived = false,
): Promise<AdminCommercialPartner[]> {
  return getAdminList<AdminCommercialPartner>(
    `/admin/commercial-partners${includeArchived ? "?include_archived=true" : ""}`,
  );
}

export function createCommercialPartner(
  payload: AdminCommercialPartnerInput,
): Promise<AdminCommercialPartner | null> {
  return requestAdmin<AdminCommercialPartner>(
    "/admin/commercial-partners",
    "POST",
    payload,
  );
}

export function updateCommercialPartner(
  id: string,
  payload: Partial<AdminCommercialPartnerInput>,
): Promise<AdminCommercialPartner | null> {
  return requestAdmin<AdminCommercialPartner>(
    `/admin/commercial-partners/${id}`,
    "PUT",
    payload,
  );
}

export function setCommercialPartnerArchived(
  id: string,
  archived: boolean,
): Promise<AdminCommercialPartner | null> {
  return requestAdmin<AdminCommercialPartner>(
    `/admin/commercial-partners/${id}/${archived ? "archive" : "restore"}`,
    "POST",
  );
}

export function createCommercialPartnerContact(
  partnerId: string,
  payload: AdminCommercialPartnerContactInput,
): Promise<AdminCommercialPartnerContact | null> {
  return requestAdmin<AdminCommercialPartnerContact>(
    `/admin/commercial-partners/${partnerId}/contacts`,
    "POST",
    payload,
  );
}

export function updateCommercialPartnerContact(
  id: string,
  payload: Partial<AdminCommercialPartnerContactInput>,
): Promise<AdminCommercialPartnerContact | null> {
  return requestAdmin<AdminCommercialPartnerContact>(
    `/admin/commercial-partner-contacts/${id}`,
    "PUT",
    payload,
  );
}

export function listCommercialPartnerHistory(
  id: string,
): Promise<AdminCommercialAuditEvent[]> {
  return getAdminList<AdminCommercialAuditEvent>(
    `/admin/commercial-partners/${id}/history`,
  );
}

export function listCommercialAgreements(
  includeArchived = false,
): Promise<AdminCommercialAgreement[]> {
  return getAdminList<AdminCommercialAgreement>(
    `/admin/commercial-agreements${includeArchived ? "?include_archived=true" : ""}`,
  );
}

export function createCommercialAgreement(
  payload: AdminCommercialAgreementCreateInput,
): Promise<AdminCommercialAgreement | null> {
  return requestAdmin<AdminCommercialAgreement>(
    "/admin/commercial-agreements",
    "POST",
    payload,
  );
}

export function setCommercialAgreementArchived(
  id: string,
  archived: boolean,
): Promise<AdminCommercialAgreement | null> {
  return requestAdmin<AdminCommercialAgreement>(
    `/admin/commercial-agreements/${id}/${archived ? "archive" : "restore"}`,
    "POST",
  );
}

export function setCommercialPartnerContactArchived(
  id: string,
  archived: boolean,
): Promise<AdminCommercialPartnerContact | null> {
  return requestAdmin<AdminCommercialPartnerContact>(
    `/admin/commercial-partner-contacts/${id}/${archived ? "archive" : "restore"}`,
    "POST",
  );
}

export function createCommercialAgreementRevision(
  agreementId: string,
  payload: AdminCommercialAgreementRevisionInput,
): Promise<AdminCommercialAgreementRevision | null> {
  return requestAdmin<AdminCommercialAgreementRevision>(
    `/admin/commercial-agreements/${agreementId}/revisions`,
    "POST",
    payload,
  );
}

export function activateCommercialAgreementRevision(
  id: string,
): Promise<AdminCommercialAgreementRevision | null> {
  return requestAdmin<AdminCommercialAgreementRevision>(
    `/admin/commercial-agreement-revisions/${id}/activate`,
    "POST",
  );
}

export function terminateCommercialAgreementRevision(
  id: string,
  endsOn: string,
): Promise<AdminCommercialAgreementRevision | null> {
  return requestAdmin<AdminCommercialAgreementRevision>(
    `/admin/commercial-agreement-revisions/${id}/terminate`,
    "POST",
    { ends_on: endsOn },
  );
}

export function listCommercialAgreementHistory(
  id: string,
): Promise<AdminCommercialAuditEvent[]> {
  return getAdminList<AdminCommercialAuditEvent>(
    `/admin/commercial-agreements/${id}/history`,
  );
}

export function listCommercialAgreementEligibility(
  productId: string,
  pointId: string,
): Promise<AdminCommercialAgreementEligibility[]> {
  const query = new URLSearchParams({
    product_id: productId,
    point_id: pointId,
  });
  return getAdminList<AdminCommercialAgreementEligibility>(
    `/admin/commercial-agreement-eligibility?${query.toString()}`,
  );
}

export function listConsumptionPoints(
  includeArchived = false,
): Promise<AdminConsumptionPoint[]> {
  return getAdminList<AdminConsumptionPoint>(
    `/admin/consumption-points${includeArchived ? "?include_archived=true" : ""}`,
  );
}

export function createConsumptionPoint(
  payload: AdminConsumptionPointInput,
): Promise<AdminConsumptionPoint | null> {
  return requestAdmin<AdminConsumptionPoint>(
    "/admin/consumption-points",
    "POST",
    payload,
  );
}

export function updateConsumptionPoint(
  id: string,
  payload: Partial<AdminConsumptionPointInput>,
): Promise<AdminConsumptionPoint | null> {
  return requestAdmin<AdminConsumptionPoint>(
    `/admin/consumption-points/${id}`,
    "PUT",
    payload,
  );
}

export function setConsumptionPointArchived(
  id: string,
  archived: boolean,
): Promise<AdminConsumptionPoint | null> {
  return requestAdmin<AdminConsumptionPoint>(
    `/admin/consumption-points/${id}/${archived ? "archive" : "restore"}`,
    "POST",
  );
}

export function reorderConsumptionPoints(
  payload: AdminConsumptionReorderInput,
): Promise<boolean> {
  return requestAdminOk("/admin/consumption-points/order", "PUT", payload);
}

export function listConsumptionOffers(options?: {
  includeArchived?: boolean;
  pointId?: string;
  productId?: string;
}): Promise<AdminConsumptionOffer[]> {
  const query = new URLSearchParams();
  if (options?.includeArchived) query.set("include_archived", "true");
  if (options?.pointId) query.set("point_id", options.pointId);
  if (options?.productId) query.set("product_id", options.productId);
  const suffix = query.size ? `?${query.toString()}` : "";
  return getAdminList<AdminConsumptionOffer>(
    `/admin/consumption-offers${suffix}`,
  );
}

export function createConsumptionOffers(
  pointId: string,
  payload: AdminConsumptionOfferBatchInput,
): Promise<AdminConsumptionOffer[]> {
  return requestAdminItems<AdminConsumptionOffer>(
    `/admin/consumption-points/${pointId}/offers`,
    "POST",
    payload,
  );
}

export function updateConsumptionOffer(
  id: string,
  payload: AdminConsumptionOfferUpdateInput,
): Promise<AdminConsumptionOffer | null> {
  return requestAdmin<AdminConsumptionOffer>(
    `/admin/consumption-offers/${id}`,
    "PUT",
    payload,
  );
}

export function reorderConsumptionOffers(
  pointId: string,
  payload: AdminConsumptionReorderInput,
): Promise<boolean> {
  return requestAdminOk(
    `/admin/consumption-points/${pointId}/offers/order`,
    "PUT",
    payload,
  );
}

export function setConsumptionOfferArchived(
  id: string,
  archived: boolean,
): Promise<AdminConsumptionOffer | null> {
  return requestAdmin<AdminConsumptionOffer>(
    `/admin/consumption-offers/${id}/${archived ? "archive" : "restore"}`,
    "POST",
  );
}

export function listConsumptionConfigurationHistory(
  entity: "consumption-points" | "consumption-offers",
  id: string,
): Promise<AdminConsumptionConfigurationAuditEvent[]> {
  return getAdminList<AdminConsumptionConfigurationAuditEvent>(
    `/admin/${entity}/${id}/history`,
  );
}

export function listConsumptionEligibleStays(
  search = "",
): Promise<AdminConsumptionEligibleStay[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return getAdminList<AdminConsumptionEligibleStay>(
    `/admin/consumption-orders/eligible-stays${query}`,
  );
}

export function getConsumptionOperationalContext(
  stayId: string,
  occurredAt?: string,
): Promise<AdminConsumptionOperationalContext> {
  const params = new URLSearchParams({ stay_id: stayId });
  if (occurredAt) params.set("occurred_at", occurredAt);
  return getAdminData<AdminItemResponse<AdminConsumptionOperationalContext>>(
    `/admin/consumption-orders/context?${params}`,
  ).then((payload) => payload.item);
}

export function postConsumptionOrder(
  input: AdminConsumptionOrderCreateInput,
): Promise<AdminConsumptionOrder | null> {
  return requestAdmin<AdminConsumptionOrder>(
    "/admin/consumption-orders",
    "POST",
    input,
  );
}

export function listConsumptionOrders(
  filters: Record<string, string | undefined> = {},
): Promise<AdminConsumptionOrderHistory> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) params.set(key, value);
  const suffix = params.size ? `?${params}` : "";
  return getAdminData<AdminConsumptionOrderHistory>(
    `/admin/consumption-orders${suffix}`,
  ).catch(() => ({ items: [], next_cursor: null }));
}

export function getConsumptionOrder(
  id: string,
): Promise<AdminConsumptionOrder | null> {
  return getAdminData<AdminItemResponse<AdminConsumptionOrder>>(
    `/admin/consumption-orders/${id}`,
  )
    .then((payload) => payload.item)
    .catch(() => null);
}

export function listSeasons(): Promise<AdminSeason[]> {
  return getAdminList<AdminSeason>("/admin/seasons");
}

export function createSeason(
  payload: AdminSeasonCreateInput,
): Promise<AdminSeason | null> {
  return requestAdmin<AdminSeason>("/admin/seasons", "POST", payload);
}

export function updateSeason(
  id: string,
  payload: AdminSeasonUpdateInput,
): Promise<AdminSeason | null> {
  return requestAdmin<AdminSeason>(`/admin/seasons/${id}`, "PUT", payload);
}

export function deleteSeason(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/seasons/${id}`, "DELETE");
}

export function listSeasonRoomRates(): Promise<AdminSeasonRoomRate[]> {
  return getAdminList<AdminSeasonRoomRate>("/admin/season-room-rates");
}

export function createSeasonRoomRate(
  payload: AdminSeasonRoomRateCreateInput,
): Promise<AdminSeasonRoomRate | null> {
  return requestAdmin<AdminSeasonRoomRate>(
    "/admin/season-room-rates",
    "POST",
    payload,
  );
}

export function updateSeasonRoomRate(
  id: string,
  payload: AdminSeasonRoomRateUpdateInput,
): Promise<AdminSeasonRoomRate | null> {
  return requestAdmin<AdminSeasonRoomRate>(
    `/admin/season-room-rates/${id}`,
    "PUT",
    payload,
  );
}

export function deleteSeasonRoomRate(id: string): Promise<null> {
  return requestAdmin<never>(`/admin/season-room-rates/${id}`, "DELETE");
}
