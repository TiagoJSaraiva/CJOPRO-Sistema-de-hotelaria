"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createReservation, deleteReservation, updateReservation } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidateReservationsPage(): void {
  revalidatePath("/dashboard/reservations");
  revalidatePath("/dashboard/reservations/create");
  revalidatePath("/dashboard/reservations/view");
}

function redirectWithStatus(status: string, section: "create" | "view" | "root" = "root", detail?: string): never {
  const nonce = Date.now().toString(36);
  const detailParam = detail ? `&detail=${encodeURIComponent(detail.slice(0, 220))}` : "";

  if (section === "root") {
    redirect(`/dashboard/reservations?status=${status}${detailParam}&r=${nonce}`);
  }

  redirect(`/dashboard/reservations/${section}?status=${status}${detailParam}&r=${nonce}`);
}

function getErrorDetail(error: unknown): string {
  if (typeof error === "object" && error !== null && "details" in error) {
    const details = String((error as { details?: unknown }).details || "").trim();

    if (details) {
      return details;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Falha inesperada ao comunicar com o backend.";
}

export async function createReservationAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.RESERVATION_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.RESERVATION_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const bookingCustomerId = String(formData.get("booking_customer_id") || "").trim();
  const bookingCustomerDocument = String(formData.get("booking_customer_document") || "").trim();
  const bookingCustomerDocumentType = String(formData.get("booking_customer_document_type") || "").trim();
  const plannedCheckinDate = String(formData.get("planned_checkin_date") || "").trim();
  const plannedCheckoutDate = String(formData.get("planned_checkout_date") || "").trim();
  const guestCount = Number(formData.get("guest_count") || "0");

  if (!bookingCustomerId && !bookingCustomerDocument) {
    redirectWithStatus("create_missing_fields", "create");
  }

  if (!plannedCheckinDate || !plannedCheckoutDate || !Number.isFinite(guestCount) || guestCount <= 0) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createReservation({
      booking_customer_id: bookingCustomerId || undefined,
      booking_customer_document: bookingCustomerDocument || undefined,
      booking_customer_document_type: bookingCustomerDocumentType || undefined,
      planned_checkin_date: plannedCheckinDate,
      planned_checkout_date: plannedCheckoutDate,
      guest_count: guestCount,
      reservation_status: (String(formData.get("reservation_status") || "pending").trim() as
        | "pending"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "canceled"
        | "no_show"),
      reservation_source: (String(formData.get("reservation_source") || "").trim() as "front_desk" | "website" | "phone" | "agency") || null,
      payment_status: (String(formData.get("payment_status") || "pending").trim() as "pending" | "partial" | "paid" | "refunded"),
      estimated_total_amount: Number(formData.get("estimated_total_amount") || "0"),
      final_total_amount: Number(formData.get("final_total_amount") || "0"),
      notes: String(formData.get("notes") || "").trim() || null
    });
  } catch (error) {
    const detail = getErrorDetail(error);

    console.error("[reservations/createReservationAction] falha ao criar reserva", {
      bookingCustomerId,
      bookingCustomerDocument,
      bookingCustomerDocumentType,
      plannedCheckinDate,
      plannedCheckoutDate,
      guestCount,
      detail
    });

    redirectWithStatus("create_error", "create", detail);
  }

  revalidateReservationsPage();
  redirectWithStatus("created", "create");
}

export async function updateReservationAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.RESERVATION_UPDATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.RESERVATION_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("update_missing_fields", "view");
  }

  try {
    await updateReservation(id, {
      booking_customer_id: String(formData.get("booking_customer_id") || "").trim(),
      planned_checkin_date: String(formData.get("planned_checkin_date") || "").trim(),
      planned_checkout_date: String(formData.get("planned_checkout_date") || "").trim(),
      guest_count: Number(formData.get("guest_count") || "0"),
      reservation_status: (String(formData.get("reservation_status") || "pending").trim() as
        | "pending"
        | "confirmed"
        | "checked_in"
        | "checked_out"
        | "canceled"
        | "no_show"),
      reservation_source: (String(formData.get("reservation_source") || "").trim() as "front_desk" | "website" | "phone" | "agency") || null,
      payment_status: (String(formData.get("payment_status") || "pending").trim() as "pending" | "partial" | "paid" | "refunded"),
      estimated_total_amount: Number(formData.get("estimated_total_amount") || "0"),
      final_total_amount: Number(formData.get("final_total_amount") || "0"),
      notes: String(formData.get("notes") || "").trim() || null
    });
  } catch {
    redirectWithStatus("update_error", "view");
  }

  revalidateReservationsPage();
  redirectWithStatus("updated", "view");
}

export async function deleteReservationAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.RESERVATION_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.RESERVATION_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("delete_missing_id", "view");
  }

  try {
    await deleteReservation(id);
  } catch {
    redirectWithStatus("delete_error", "view");
  }

  revalidateReservationsPage();
  redirectWithStatus("deleted", "view");
}
