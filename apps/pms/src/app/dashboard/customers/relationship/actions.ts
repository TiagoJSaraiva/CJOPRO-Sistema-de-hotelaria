"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestOperationsFinanceEndpoint } from "../../../../lib/adminApi";
import { failureStatus } from "../../_components/operationOutcome";

const text = (form: FormData, key: string) =>
  String(form.get(key) || "").trim();

export async function createGuestPreferenceAction(form: FormData) {
  const customerId = text(form, "customer_id");
  const path = "/dashboard/customers/relationship";
  const back = `${path}?customerId=${encodeURIComponent(customerId)}`;
  try {
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
  } catch (error) {
    redirect(`${back}&status=${failureStatus(error)}`);
  }
  revalidatePath(path);
  redirect(`${back}&status=preference-created`);
}
