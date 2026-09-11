"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestOperationsFinanceEndpoint } from "../../../lib/adminApi";
export async function createOrganizationAction(form: FormData) {
  try {
    await requestOperationsFinanceEndpoint("business-organizations", "POST", {
      legal_name: String(form.get("legal_name") || "").trim(),
      trade_name: String(form.get("trade_name") || "").trim() || undefined,
      tax_id: String(form.get("tax_id") || "").trim() || undefined,
      currency: String(form.get("currency") || "BRL"),
      email: String(form.get("email") || "").trim() || undefined,
      phone: String(form.get("phone") || "").trim() || undefined,
      active: true,
      roles: form.get("stock_supplier") === "on" ? ["stock_supplier"] : [],
    });
    revalidatePath("/dashboard/organizations");
    redirect("/dashboard/organizations?status=created");
  } catch {
    redirect("/dashboard/organizations?status=conflict");
  }
}
export async function actOrganizationAction(form: FormData) {
  const id = String(form.get("id") || "");
  const [selectedRoleType, selectedRoleId] = String(
    form.get("role_choice") || ":",
  ).split(":");
  try {
    await requestOperationsFinanceEndpoint(
      `business-organizations/${id}/actions`,
      "POST",
      {
        action: String(form.get("action") || ""),
        expected_version: Number(form.get("version")),
        target_id: String(form.get("target_id") || "") || undefined,
        role_type: selectedRoleType || undefined,
        role_id: selectedRoleId || undefined,
        conflict_id: String(form.get("conflict_id") || "") || undefined,
        reason: String(form.get("reason") || "").trim(),
      },
    );
    revalidatePath("/dashboard/organizations");
    redirect("/dashboard/organizations?status=updated");
  } catch {
    redirect(`/dashboard/organizations?id=${id}&status=conflict`);
  }
}
