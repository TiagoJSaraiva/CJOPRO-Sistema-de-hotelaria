"use server";

import { PERMISSIONS } from "@hotel/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPartnerSettlement,
  decidePartnerSettlement,
  payPartnerSettlement,
  recalculatePartnerSettlement,
  reversePartnerSettlementPayment,
  submitPartnerSettlement,
  updateConsumptionManagementSettings,
} from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

const settlementsPath = "/dashboard/consumption/settlements";

function returnTo(status: string, id?: string): never {
  const params = new URLSearchParams({ status });
  if (id) params.set("id", id);
  redirect(`${settlementsPath}?${params}`);
}

async function requirePermission(permission: string) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(permission)) returnTo("forbidden");
  return user;
}

function mapError(error: unknown) {
  const details = (error as Error & { details?: string }).details;
  return details || "conflict";
}

export async function updateManagementSettingsAction(formData: FormData) {
  await requirePermission(PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE);
  try {
    await updateConsumptionManagementSettings({
      settlement_tracking_starts_on: String(
        formData.get("settlement_tracking_starts_on") || "",
      ),
      payment_due_days: Number(formData.get("payment_due_days") || 5),
      agreement_expiry_alert_days: Number(
        formData.get("agreement_expiry_alert_days") || 30,
      ),
      guest_balance_alert_days: Number(
        formData.get("guest_balance_alert_days") || 0,
      ),
    });
  } catch (error) {
    returnTo(mapError(error));
  }
  revalidatePath(settlementsPath);
  returnTo("settings-updated");
}

export async function createSettlementAction(formData: FormData) {
  await requirePermission(PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE);
  let settlementId: string | undefined;
  try {
    const settlement = await createPartnerSettlement({
      partner_id: String(formData.get("partner_id") || ""),
      period_start: String(formData.get("period_start") || ""),
    });
    settlementId = settlement?.id;
  } catch (error) {
    returnTo(mapError(error));
  }
  revalidatePath(settlementsPath);
  returnTo("created", settlementId);
}

export async function recalculateSettlementAction(formData: FormData) {
  await requirePermission(PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE);
  const id = String(formData.get("id") || "");
  try {
    await recalculatePartnerSettlement(id, {
      expected_version: Number(formData.get("expected_version")),
    });
  } catch (error) {
    returnTo(mapError(error), id);
  }
  revalidatePath(settlementsPath);
  returnTo("recalculated", id);
}

export async function submitSettlementAction(formData: FormData) {
  await requirePermission(PERMISSIONS.PARTNER_SETTLEMENTS_PREPARE);
  const id = String(formData.get("id") || "");
  try {
    await submitPartnerSettlement(id, {
      expected_version: Number(formData.get("expected_version")),
    });
  } catch (error) {
    returnTo(mapError(error), id);
  }
  revalidatePath(settlementsPath);
  returnTo("submitted", id);
}

export async function decideSettlementAction(formData: FormData) {
  await requirePermission(PERMISSIONS.PARTNER_SETTLEMENTS_APPROVE);
  const id = String(formData.get("id") || "");
  const decision = formData.get("decision") === "reject" ? "reject" : "approve";
  try {
    await decidePartnerSettlement(id, {
      expected_version: Number(formData.get("expected_version")),
      decision,
      reason: String(formData.get("reason") || "").trim() || null,
    });
  } catch (error) {
    returnTo(mapError(error), id);
  }
  revalidatePath(settlementsPath);
  returnTo(decision === "approve" ? "approved" : "rejected", id);
}

export async function paySettlementAction(formData: FormData) {
  await requirePermission(PERMISSIONS.PARTNER_SETTLEMENTS_SETTLE);
  const id = String(formData.get("id") || "");
  try {
    await payPartnerSettlement(id, {
      expected_version: Number(formData.get("expected_version")),
      amount: Number(formData.get("amount")),
      payment_method: String(formData.get("payment_method")) as
        "cash" | "pix" | "credit_card" | "debit_card" | "bank_transfer",
      paid_at: String(formData.get("paid_at")),
      reference_code:
        String(formData.get("reference_code") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      idempotency_key: crypto.randomUUID(),
    });
  } catch (error) {
    returnTo(mapError(error), id);
  }
  revalidatePath(settlementsPath);
  returnTo("settled", id);
}

export async function reverseSettlementPaymentAction(formData: FormData) {
  await requirePermission(PERMISSIONS.PARTNER_SETTLEMENTS_SETTLE);
  const id = String(formData.get("settlement_id") || "");
  try {
    await reversePartnerSettlementPayment(String(formData.get("payment_id")), {
      reason: String(formData.get("reason") || ""),
      reversed_at: String(formData.get("reversed_at")),
      idempotency_key: crypto.randomUUID(),
    });
  } catch (error) {
    returnTo(mapError(error), id);
  }
  revalidatePath(settlementsPath);
  returnTo("payment-reversed", id);
}
