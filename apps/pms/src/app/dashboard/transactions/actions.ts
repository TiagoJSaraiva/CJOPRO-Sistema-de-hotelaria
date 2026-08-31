"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import {
  createFinancialTransaction,
  deleteFinancialTransaction,
  updateFinancialTransaction,
} from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

const TRANSACTION_TYPES = new Set(["INCOME", "EXPENSE", "REFUND"]);
const TRANSACTION_STATUSES = new Set([
  "PENDING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
]);
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function revalidateTransactionPage(): void {
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/transactions/create");
  revalidatePath("/dashboard/transactions/view");
}

function redirectWithStatus(
  status: string,
  section: "create" | "view" | "root" = "root",
): never {
  const nonce = Date.now().toString(36);

  if (section === "root") {
    redirect(`/dashboard/transactions?status=${status}&r=${nonce}`);
  }

  redirect(`/dashboard/transactions/${section}?status=${status}&r=${nonce}`);
}

function normalizeStatus(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeOptionalText(
  value: FormDataEntryValue | null,
): string | null {
  const text = String(value || "").trim();
  return text.length ? text : null;
}

function normalizeCurrency(value: FormDataEntryValue | null): string {
  return normalizeStatus(String(value || "BRL"));
}

function normalizeOptionalUuid(
  value: FormDataEntryValue | null,
): string | null | undefined {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  return UUID_PATTERN.test(text) ? text : undefined;
}

function normalizeOptionalDateOnly(
  value: FormDataEntryValue | null,
): string | null | undefined {
  const text = normalizeOptionalText(value);
  if (!text) return null;

  if (!DATE_ONLY_PATTERN.test(text)) {
    return undefined;
  }

  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== text
    ? undefined
    : text;
}

function normalizeOptionalDateTime(
  value: FormDataEntryValue | null,
): string | null | undefined {
  const text = normalizeOptionalText(value);
  if (!text) return null;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export async function createTransactionAction(
  formData: FormData,
): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.TRANSACTION_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.TRANSACTION_READ)
      ? "view"
      : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const type = normalizeStatus(String(formData.get("type") || ""));
  const category = normalizeOptionalText(formData.get("category"));
  const amount = Number(formData.get("amount") || "0");
  const currency = normalizeCurrency(formData.get("currency"));
  const description = normalizeOptionalText(formData.get("description"));
  const status = normalizeStatus(String(formData.get("status") || "COMPLETED"));
  const paymentMethod = normalizeOptionalText(formData.get("payment_method"));
  const paidAt = normalizeOptionalDateTime(formData.get("paid_at"));
  const dueDate = normalizeOptionalDateOnly(formData.get("due_date"));
  const counterparty = normalizeOptionalText(formData.get("counterparty"));
  const costCenter = normalizeOptionalText(formData.get("cost_center"));
  const referenceCode = normalizeOptionalText(formData.get("reference_code"));
  const stayId = normalizeOptionalUuid(formData.get("stay_id"));
  const reservationId = normalizeOptionalUuid(formData.get("reservation_id"));

  if (
    !TRANSACTION_TYPES.has(type) ||
    !category ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    !CURRENCY_PATTERN.test(currency) ||
    !TRANSACTION_STATUSES.has(status) ||
    paidAt === undefined ||
    dueDate === undefined ||
    stayId === undefined ||
    reservationId === undefined
  ) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createFinancialTransaction({
      type: type as "INCOME" | "EXPENSE" | "REFUND",
      category,
      amount,
      currency,
      description,
      status: status as
        "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REFUNDED",
      payment_method: paymentMethod,
      paid_at: paidAt,
      due_date: dueDate,
      counterparty,
      cost_center: costCenter,
      reference_code: referenceCode,
      stay_id: stayId,
      reservation_id: reservationId,
    });
  } catch {
    redirectWithStatus("create_error", "create");
  }

  revalidateTransactionPage();
  redirectWithStatus("created", "create");
}

export async function updateTransactionAction(
  formData: FormData,
): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.TRANSACTION_UPDATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.TRANSACTION_READ)
      ? "view"
      : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  const type = normalizeStatus(String(formData.get("type") || ""));
  const category = normalizeOptionalText(formData.get("category"));
  const amount = Number(formData.get("amount") || "0");
  const currency = normalizeCurrency(formData.get("currency"));
  const description = normalizeOptionalText(formData.get("description"));
  const status = normalizeStatus(String(formData.get("status") || "COMPLETED"));
  const paymentMethod = normalizeOptionalText(formData.get("payment_method"));
  const paidAt = normalizeOptionalDateTime(formData.get("paid_at"));
  const dueDate = normalizeOptionalDateOnly(formData.get("due_date"));
  const counterparty = normalizeOptionalText(formData.get("counterparty"));
  const costCenter = normalizeOptionalText(formData.get("cost_center"));
  const referenceCode = normalizeOptionalText(formData.get("reference_code"));
  const stayId = normalizeOptionalUuid(formData.get("stay_id"));
  const reservationId = normalizeOptionalUuid(formData.get("reservation_id"));

  if (
    !id ||
    !TRANSACTION_TYPES.has(type) ||
    !category ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    !CURRENCY_PATTERN.test(currency) ||
    !TRANSACTION_STATUSES.has(status) ||
    paidAt === undefined ||
    dueDate === undefined ||
    stayId === undefined ||
    reservationId === undefined
  ) {
    redirectWithStatus("update_missing_fields", "view");
  }

  try {
    await updateFinancialTransaction(id, {
      type: type as "INCOME" | "EXPENSE" | "REFUND",
      category,
      amount,
      currency,
      description,
      status: status as
        "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REFUNDED",
      payment_method: paymentMethod,
      paid_at: paidAt,
      due_date: dueDate,
      counterparty,
      cost_center: costCenter,
      reference_code: referenceCode,
      stay_id: stayId,
      reservation_id: reservationId,
    });
  } catch {
    redirectWithStatus("update_error", "view");
  }

  revalidateTransactionPage();
  redirectWithStatus("updated", "view");
}

export async function deleteTransactionAction(
  formData: FormData,
): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.TRANSACTION_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.TRANSACTION_READ)
      ? "view"
      : "root";
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
