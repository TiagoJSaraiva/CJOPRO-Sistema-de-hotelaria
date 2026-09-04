"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import {
  confirmPartnerCorrectionRefund,
  decideConsumptionCorrection,
  createStayRefund,
  getStayAccount,
  requestConsumptionCorrection,
} from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function back(status: string): never {
  redirect(
    `/dashboard/consumption/adjustments?status=${encodeURIComponent(status)}`,
  );
}

export async function createCorrectionRefundAction(formData: FormData) {
  const user = await getUserFromSession();
  const stayId = String(formData.get("stay_id") || "");
  if (!user?.permissions.includes(PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE))
    redirect(
      `/dashboard/reservations/account?stay_id=${stayId}&status=forbidden`,
    );
  const correctionId = String(formData.get("correction_id") || "");
  const amount = Number(formData.get("amount") || 0);
  const paymentMethod = String(formData.get("payment_method") || "pix") as
    "cash" | "pix" | "credit_card" | "debit_card" | "bank_transfer";
  if (!stayId || !correctionId || amount <= 0)
    redirect(
      `/dashboard/reservations/account?stay_id=${stayId}&status=invalid`,
    );
  try {
    const account = await getStayAccount(stayId);
    await createStayRefund(stayId, {
      amount,
      payment_method: paymentMethod,
      reason: "Reembolso de correção aprovada",
      idempotency_key: crypto.randomUUID(),
      expected_version: account.version,
      correction_id: correctionId,
      reference_code:
        String(formData.get("reference_code") || "").trim() || null,
    });
  } catch (error) {
    const details = (error as Error & { details?: string }).details;
    redirect(
      `/dashboard/reservations/account?stay_id=${stayId}&status=${details === "version_conflict" ? "version-conflict" : "conflict"}`,
    );
  }
  revalidatePath("/dashboard/consumption/adjustments");
  revalidatePath(`/dashboard/reservations/account`);
  redirect(`/dashboard/reservations/account?stay_id=${stayId}&status=refunded`);
}

export async function reverseStayPaymentAction(formData: FormData) {
  const user = await getUserFromSession();
  const stayId = String(formData.get("stay_id") || "");
  if (!user?.permissions.includes(PERMISSIONS.CONSUMPTION_PAYMENT_RECEIVE))
    redirect(
      `/dashboard/reservations/account?stay_id=${stayId}&status=forbidden`,
    );
  const tenderId = String(formData.get("original_tender_id") || "");
  const amount = Number(formData.get("amount") || 0);
  const paymentMethod = String(formData.get("payment_method") || "pix") as
    "cash" | "pix" | "credit_card" | "debit_card" | "bank_transfer";
  if (!stayId || !tenderId || amount <= 0)
    redirect(
      `/dashboard/reservations/account?stay_id=${stayId}&status=invalid`,
    );
  try {
    const account = await getStayAccount(stayId);
    await createStayRefund(stayId, {
      amount,
      payment_method: paymentMethod,
      reason: "Estorno de pagamento antes do checkout",
      idempotency_key: crypto.randomUUID(),
      expected_version: account.version,
      original_tender_id: tenderId,
    });
  } catch (error) {
    const details = (error as Error & { details?: string }).details;
    redirect(
      `/dashboard/reservations/account?stay_id=${stayId}&status=${details === "version_conflict" ? "version-conflict" : "conflict"}`,
    );
  }
  revalidatePath("/dashboard/reservations/account");
  redirect(
    `/dashboard/reservations/account?stay_id=${stayId}&status=payment-reversed`,
  );
}

export async function requestConsumptionCorrectionAction(formData: FormData) {
  const user = await getUserFromSession();
  const kind =
    formData.get("kind") === "full_void" ? "full_void" : "partial_adjustment";
  const permission =
    kind === "full_void"
      ? PERMISSIONS.CONSUMPTION_VOID
      : PERMISSIONS.CONSUMPTION_POST;
  if (!user?.permissions.includes(permission)) back("forbidden");
  const orderId = String(formData.get("order_id") || "");
  const stayId = String(formData.get("stay_id") || "");
  const expectedVersion = Number(formData.get("expected_version") || 0);
  const reason = String(formData.get("reason") || "").trim();
  if (!orderId || !stayId || reason.length < 3) back("invalid");
  try {
    const itemIds = formData.getAll("order_item_id").map(String);
    const quantities = formData.getAll("resulting_quantity").map(Number);
    const discounts = formData.getAll("additional_discount").map(Number);
    await requestConsumptionCorrection(orderId, {
      kind,
      reason,
      expected_version: expectedVersion,
      items:
        kind === "partial_adjustment"
          ? itemIds.map((order_item_id, index) => ({
              order_item_id,
              resulting_quantity: quantities[index] || 0,
              additional_discount: discounts[index] || 0,
            }))
          : undefined,
    });
  } catch (error) {
    const details = (error as Error & { details?: string }).details;
    back(details === "version_conflict" ? "version-conflict" : "conflict");
  }
  revalidatePath("/dashboard/consumption/history");
  revalidatePath("/dashboard/consumption/adjustments");
  back(kind === "full_void" ? "void-requested" : "adjustment-requested");
}

export async function decideConsumptionCorrectionAction(formData: FormData) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.CONSUMPTION_ADJUSTMENT_APPROVE))
    back("forbidden");
  const id = String(formData.get("id") || "");
  const decision = formData.get("decision") === "reject" ? "reject" : "approve";
  const reason = String(formData.get("reason") || "").trim() || null;
  if (!id || (decision === "reject" && !reason)) back("invalid");
  try {
    await decideConsumptionCorrection(id, { decision, reason });
  } catch (error) {
    const details = (error as Error & { details?: string }).details;
    back(details === "self_approval" ? "self-approval" : "conflict");
  }
  revalidatePath("/dashboard/consumption/adjustments");
  back(decision === "approve" ? "approved" : "rejected");
}

export async function confirmPartnerRefundAction(formData: FormData) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.CONSUMPTION_ADJUSTMENT_APPROVE))
    back("forbidden");
  const id = String(formData.get("id") || "");
  if (!id) back("invalid");
  try {
    await confirmPartnerCorrectionRefund(id, {
      reference_code:
        String(formData.get("reference_code") || "").trim() || null,
    });
  } catch {
    back("conflict");
  }
  revalidatePath("/dashboard/consumption/adjustments");
  back("partner-refund-confirmed");
}
