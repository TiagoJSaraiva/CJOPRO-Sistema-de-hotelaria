"use server";

import { revalidatePath } from "next/cache";
import {
  actCorporateCreditAuthorization,
  createCorporateAccount,
  payCorporateReceivable,
  requestCorporateCredit,
} from "../../../../lib/adminApi";

export async function createCorporateAccountAction(formData: FormData) {
  try {
    await createCorporateAccount({
      legal_name: String(formData.get("legal_name")),
      tax_id: String(formData.get("tax_id")),
      billing_email: String(formData.get("billing_email") || "") || undefined,
      billing_phone: String(formData.get("billing_phone") || "") || undefined,
      currency: String(formData.get("currency") || "BRL"),
      credit_limit: Number(formData.get("credit_limit")),
      payment_term_days: Number(formData.get("payment_term_days")),
      covered_category_ids: [],
      covers_maintenance: false,
      active: true,
    });
    revalidatePath("/dashboard/consumption/companies");
  } catch (cause) {
    throw new Error((cause as Error).message);
  }
}

export async function requestCorporateCreditAction(formData: FormData) {
  await requestCorporateCredit({
    stay_id: String(formData.get("stay_id")),
    corporate_account_id: String(formData.get("corporate_account_id")),
    amount_limit: Number(formData.get("amount_limit")),
    covered_category_ids: [],
    covers_maintenance: formData.get("covers_maintenance") === "on",
    expires_at: new Date(String(formData.get("expires_at"))).toISOString(),
    reason: String(formData.get("reason")),
  });
  revalidatePath("/dashboard/consumption/companies");
}

export async function actCorporateCreditAction(formData: FormData) {
  await actCorporateCreditAuthorization(String(formData.get("id")), {
    action: String(formData.get("action")) as
      "submit" | "approve" | "reject" | "revoke",
    expected_version: Number(formData.get("version")),
    reason: String(formData.get("reason")),
  });
  revalidatePath("/dashboard/consumption/companies");
}

export async function payCorporateReceivableAction(formData: FormData) {
  await payCorporateReceivable(String(formData.get("id")), {
    expected_version: Number(formData.get("version")),
    idempotency_key: crypto.randomUUID(),
    tenders: [
      {
        payment_method: String(formData.get("payment_method")),
        amount: Number(formData.get("amount")),
        reference_code:
          String(formData.get("reference_code") || "") || undefined,
      },
    ],
  });
  revalidatePath("/dashboard/consumption/companies");
}
