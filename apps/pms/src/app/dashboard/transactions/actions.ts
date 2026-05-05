"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import {
  createFinancialTransaction,
  deleteFinancialTransaction,
  updateFinancialTransaction
} from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

const TRANSACTION_TYPES = new Set(["INCOME", "EXPENSE", "REFUND"]);
const TRANSACTION_STATUSES = new Set(["PENDING", "COMPLETED", "FAILED", "CANCELLED", "REFUNDED"]);

function revalidateTransactionPage(): void {
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/transactions/create");
  revalidatePath("/dashboard/transactions/view");
}

function redirectWithStatus(status: string, section: "create" | "view" | "root" = "root"): never {
  const nonce = Date.now().toString(36);

  if (section === "root") {
    redirect(`/dashboard/transactions?status=${status}&r=${nonce}`);
  }

  redirect(`/dashboard/transactions/${section}?status=${status}&r=${nonce}`);
}

function normalizeStatus(value: string): string {
  return value.trim().toUpperCase();
}

export async function createTransactionAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.TRANSACTION_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.TRANSACTION_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const type = normalizeStatus(String(formData.get("type") || ""));
  const category = String(formData.get("category") || "").trim();
  const amount = Number(formData.get("amount") || "0");
  const currency = normalizeStatus(String(formData.get("currency") || "BRL"));
  const description = String(formData.get("description") || "").trim() || null;
  const status = normalizeStatus(String(formData.get("status") || "COMPLETED"));

  if (!TRANSACTION_TYPES.has(type) || !category || !Number.isFinite(amount) || amount < 0 || !currency || !TRANSACTION_STATUSES.has(status)) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createFinancialTransaction({
      type: type as "INCOME" | "EXPENSE" | "REFUND",
      category,
      amount,
      currency,
      description,
      status: status as "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REFUNDED"
    });
  } catch {
    redirectWithStatus("create_error", "create");
  }

  revalidateTransactionPage();
  redirectWithStatus("created", "create");
}

export async function updateTransactionAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.TRANSACTION_UPDATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.TRANSACTION_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  const type = normalizeStatus(String(formData.get("type") || ""));
  const category = String(formData.get("category") || "").trim();
  const amount = Number(formData.get("amount") || "0");
  const currency = normalizeStatus(String(formData.get("currency") || "BRL"));
  const description = String(formData.get("description") || "").trim() || null;
  const status = normalizeStatus(String(formData.get("status") || "COMPLETED"));

  if (!id || !TRANSACTION_TYPES.has(type) || !category || !Number.isFinite(amount) || amount < 0 || !currency || !TRANSACTION_STATUSES.has(status)) {
    redirectWithStatus("update_missing_fields", "view");
  }

  try {
    await updateFinancialTransaction(id, {
      type: type as "INCOME" | "EXPENSE" | "REFUND",
      category,
      amount,
      currency,
      description,
      status: status as "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REFUNDED"
    });
  } catch {
    redirectWithStatus("update_error", "view");
  }

  revalidateTransactionPage();
  redirectWithStatus("updated", "view");
}

export async function deleteTransactionAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.TRANSACTION_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.TRANSACTION_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("delete_missing_id", "view");
  }

  try {
    await deleteFinancialTransaction(id);
  } catch {
    redirectWithStatus("delete_error", "view");
  }

  revalidateTransactionPage();
  redirectWithStatus("deleted", "view");
}
