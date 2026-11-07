"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestOperationsFinanceEndpoint } from "../../../../lib/adminApi";
import { failureStatus } from "../../_components/operationOutcome";

const PATH = "/dashboard/reservations/unassigned";
const text = (form: FormData, key: string) =>
  String(form.get(key) || "").trim();

async function run(endpoint: string, body: unknown, status: string) {
  try {
    await requestOperationsFinanceEndpoint(endpoint, "POST", body);
  } catch (error) {
    redirect(`${PATH}?status=${failureStatus(error)}`);
  }
  revalidatePath(PATH);
  redirect(`${PATH}?status=${status}`);
}

export async function linkReservationCustomerAction(form: FormData) {
  const fullName = text(form, "full_name");
  await run(
    `reservations/${text(form, "id")}/booking-customer`,
    {
      expected_version: Number(text(form, "version")),
      ...(fullName
        ? {
            new_customer: {
              full_name: fullName,
              document_type: text(form, "document_type"),
              document_number: text(form, "document_number"),
              birth_date: text(form, "birth_date"),
              email: text(form, "email") || undefined,
              mobile_phone: text(form, "mobile_phone") || undefined,
            },
          }
        : { customer_id: text(form, "customer_id") }),
    },
    "reservation-customer-linked",
  );
}

export async function assignReservationRoomAction(form: FormData) {
  await run(
    `reservations/${text(form, "id")}/room-assignments`,
    {
      accommodation_id: text(form, "accommodation_id"),
      room_id: text(form, "room_id"),
      expected_version: Number(text(form, "version")),
      idempotency_key: randomUUID(),
      reason: text(form, "reason"),
    },
    "reservation-room-assigned",
  );
}

export async function cancelUnassignedReservationAction(form: FormData) {
  await run(
    `reservations/${text(form, "id")}/actions`,
    {
      action: "cancel",
      expected_version: Number(text(form, "version")),
      reason: text(form, "reason"),
    },
    "reservation-canceled",
  );
}
