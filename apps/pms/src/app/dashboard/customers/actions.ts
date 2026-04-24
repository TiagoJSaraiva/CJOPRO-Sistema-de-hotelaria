"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createCustomer, deleteCustomer, updateCustomer } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidateCustomerPage(): void {
  revalidatePath("/dashboard/customers");
}

function redirectWithStatus(status: string): never {
  redirect(`/dashboard/customers?status=${status}&r=${Date.now().toString(36)}`);
}

export async function createCustomerAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.CUSTOMER_CREATE)) redirectWithStatus("forbidden");

  const fullName = String(formData.get("full_name") || "").trim();
  const documentNumber = String(formData.get("document_number") || "").trim();
  const documentType = String(formData.get("document_type") || "").trim();
  const birthDate = String(formData.get("birth_date") || "").trim();

  if (!fullName || !documentNumber || !documentType || !birthDate) {
    redirectWithStatus("create_missing_fields");
  }

  try {
    await createCustomer({
      full_name: fullName,
      document_number: documentNumber,
      document_type: documentType,
      birth_date: birthDate,
      email: String(formData.get("email") || "").trim() || null,
      mobile_phone: String(formData.get("mobile_phone") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      nationality: String(formData.get("nationality") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null
    });
  } catch {
    redirectWithStatus("create_error");
  }

  revalidateCustomerPage();
  redirectWithStatus("created");
}

export async function updateCustomerAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.CUSTOMER_UPDATE)) redirectWithStatus("forbidden");

  const id = String(formData.get("id") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();

  if (!id || !fullName) {
    redirectWithStatus("update_missing_fields");
  }

  try {
    await updateCustomer(id, {
      full_name: fullName,
      document_number: String(formData.get("document_number") || "").trim(),
      document_type: String(formData.get("document_type") || "").trim(),
      birth_date: String(formData.get("birth_date") || "").trim(),
      email: String(formData.get("email") || "").trim() || null,
      mobile_phone: String(formData.get("mobile_phone") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      nationality: String(formData.get("nationality") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null
    });
  } catch {
    redirectWithStatus("update_error");
  }

  revalidateCustomerPage();
  redirectWithStatus("updated");
}

export async function deleteCustomerAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.CUSTOMER_DELETE)) redirectWithStatus("forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) redirectWithStatus("delete_missing_id");

  try {
    await deleteCustomer(id);
  } catch {
    redirectWithStatus("delete_error");
  }

  revalidateCustomerPage();
  redirectWithStatus("deleted");
}
