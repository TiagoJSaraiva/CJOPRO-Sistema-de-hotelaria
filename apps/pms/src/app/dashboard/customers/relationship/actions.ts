"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestOperationsFinanceEndpoint } from "../../../../lib/adminApi";

const text = (form: FormData, key: string) =>
  String(form.get(key) || "").trim();

export async function createGuestPreferenceAction(form: FormData) {
  const customerId = text(form, "customer_id");
  await requestOperationsFinanceEndpoint(
    `customers/${customerId}/preferences`,
    "POST",
    {
      category: text(form, "category"),
      value: text(form, "value"),
      source: text(form, "source"),
      consent_version: text(form, "consent_version"),
      valid_until: text(form, "valid_until") || null,
    },
  );
  const path = "/dashboard/customers/relationship";
  revalidatePath(path);
  redirect(
    `${path}?customerId=${encodeURIComponent(customerId)}&status=${encodeURIComponent("Preferência declarada registrada.")}`,
  );
}
