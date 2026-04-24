"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createReservation, deleteReservation, updateReservation } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidateReservationsPage(): void {
  revalidatePath("/dashboard/reservations");
}

function redirectWithStatus(status: string): never {
  redirect(`/dashboard/reservations?status=${status}&r=${Date.now().toString(36)}`);
}

export async function createReservationAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.RESERVATION_CREATE)) redirectWithStatus("forbidden");

  const bookingCustomerId = String(formData.get("booking_customer_id") || "").trim();
  const reservationCode = String(formData.get("reservation_code") || "").trim();
  const plannedCheckinDate = String(formData.get("planned_checkin_date") || "").trim();
  const plannedCheckoutDate = String(formData.get("planned_checkout_date") || "").trim();
  const guestCount = Number(formData.get("guest_count") || "0");

  if (!bookingCustomerId || !reservationCode || !plannedCheckinDate || !plannedCheckoutDate || !Number.isFinite(guestCount) || guestCount <= 0) {
    redirectWithStatus("create_missing_fields");
  }

  try {
    await createReservation({
      booking_customer_id: bookingCustomerId,
      reservation_code: reservationCode,
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
  } catch {
    redirectWithStatus("create_error");
  }

  revalidateReservationsPage();
  redirectWithStatus("created");
}

export async function updateReservationAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.RESERVATION_UPDATE)) redirectWithStatus("forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) redirectWithStatus("update_missing_fields");

  try {
    await updateReservation(id, {
      booking_customer_id: String(formData.get("booking_customer_id") || "").trim(),
      reservation_code: String(formData.get("reservation_code") || "").trim(),
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
    redirectWithStatus("update_error");
  }

  revalidateReservationsPage();
  redirectWithStatus("updated");
}

export async function deleteReservationAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.RESERVATION_DELETE)) redirectWithStatus("forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) redirectWithStatus("delete_missing_id");

  try {
    await deleteReservation(id);
  } catch {
    redirectWithStatus("delete_error");
  }

  revalidateReservationsPage();
  redirectWithStatus("deleted");
}
