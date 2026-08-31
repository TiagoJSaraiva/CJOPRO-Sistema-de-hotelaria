"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidateCustomerPage(): void {
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/customers/create");
  revalidatePath("/dashboard/customers/view");
}

function redirectWithStatus(
  status: string,
  section: "create" | "view" | "root" = "root",
  detail?: string,
): never {
  const nonce = Date.now().toString(36);
  const detailParam = detail
    ? `&detail=${encodeURIComponent(detail.slice(0, 220))}`
    : "";

  if (section === "root") {
    redirect(`/dashboard/customers?status=${status}${detailParam}&r=${nonce}`);
  }

  redirect(
    `/dashboard/customers/${section}?status=${status}${detailParam}&r=${nonce}`,
  );
}

function getErrorDetail(error: unknown): string {
  if (typeof error === "object" && error !== null && "details" in error) {
    const details = String(
      (error as { details?: unknown }).details || "",
    ).trim();

    if (details) {
      return details;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Falha inesperada ao comunicar com o backend.";
}

export async function createCustomerAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.CUSTOMER_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.CUSTOMER_READ)
      ? "view"
      : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const fullName = String(formData.get("full_name") || "").trim();
  const documentNumber = String(formData.get("document_number") || "").trim();
  const documentType = String(formData.get("document_type") || "").trim();
  const birthDate = String(formData.get("birth_date") || "").trim();

  if (!fullName || !documentNumber || !documentType || !birthDate) {
    redirectWithStatus("create_missing_fields", "create");
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
      notes: String(formData.get("notes") || "").trim() || null,
    });
  } catch (error) {
    const detail = getErrorDetail(error);

    console.error("[customers/createCustomerAction] falha ao criar cliente", {
      fullName,
      documentNumber,
      documentType,
      birthDate,
      detail,
    });

    redirectWithStatus("create_error", "create", detail);
  }

  revalidateCustomerPage();
  redirectWithStatus("created", "create");
}

export async function updateCustomerAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.CUSTOMER_UPDATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.CUSTOMER_READ)
      ? "view"
      : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();

  if (!id || !fullName) {
    redirectWithStatus("update_missing_fields", "view");
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
      notes: String(formData.get("notes") || "").trim() || null,
    });
  } catch {
    redirectWithStatus("update_error", "view");
  }

  revalidateCustomerPage();
  redirectWithStatus("updated", "view");
}

export async function deleteCustomerAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.CUSTOMER_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.CUSTOMER_READ)
      ? "view"
      : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("delete_missing_id", "view");
  }

  try {
    await deleteCustomer(id);
  } catch {
    redirectWithStatus("delete_error", "view");
  }

  revalidateCustomerPage();
  redirectWithStatus("deleted", "view");
}
