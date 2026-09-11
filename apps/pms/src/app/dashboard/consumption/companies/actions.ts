"use server";

import { revalidatePath } from "next/cache";
import { createCorporateAccount } from "../../../../lib/adminApi";

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
