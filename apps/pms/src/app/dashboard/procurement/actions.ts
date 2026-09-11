"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestOperationsFinanceEndpoint } from "../../../lib/adminApi";

const go = (status: string): never =>
  redirect(`/dashboard/procurement?status=${encodeURIComponent(status)}`);
const text = (form: FormData, name: string) =>
  String(form.get(name) || "").trim();
const number = (form: FormData, name: string) => Number(form.get(name));
async function run(
  path: string,
  method: "POST" | "PUT",
  body: unknown,
  status: string,
) {
  try {
    await requestOperationsFinanceEndpoint(path, method, body);
    revalidatePath("/dashboard/procurement");
    go(status);
  } catch {
    go("conflict");
  }
}
export async function reconcileProcurementAction() {
  await run("procurement/reconcile", "POST", {}, "updated");
}
export async function saveProcurementPolicyAction(form: FormData) {
  const threshold = number(form, "second_tier_from");
  await run(
    "procurement/policy",
    "PUT",
    {
      currency: text(form, "currency"),
      price_tolerance_percent: number(form, "price_tolerance_percent"),
      price_tolerance_amount: number(form, "price_tolerance_amount"),
      quantity_tolerance_percent: number(form, "quantity_tolerance_percent"),
      quantity_tolerance_amount: number(form, "quantity_tolerance_amount"),
      tiers: [
        {
          minimum_amount: 0,
          maximum_amount: Math.max(0, threshold - 0.01),
          approvals_required: 1,
          quotes_required: number(form, "base_quotes"),
        },
        {
          minimum_amount: threshold,
          maximum_amount: null,
          approvals_required: 2,
          quotes_required: number(form, "high_quotes"),
        },
      ],
    },
    "policy-saved",
  );
}
export async function createReplenishmentAction(form: FormData) {
  await run(
    "procurement/replenishment-requests",
    "POST",
    {
      product_id: text(form, "product_id"),
      location_id: text(form, "location_id"),
      requested_quantity: number(form, "requested_quantity"),
      priority: text(form, "priority"),
      need_by: text(form, "need_by") || undefined,
      reason: text(form, "reason"),
    },
    "created",
  );
}
export async function actReplenishmentAction(form: FormData) {
  await run(
    `procurement/replenishment-requests/${text(form, "id")}/actions`,
    "POST",
    {
      action: text(form, "action"),
      expected_version: number(form, "version"),
      reason: text(form, "reason") || "Decisão operacional registrada.",
    },
    "updated",
  );
}
export async function createPurchaseOrderAction(form: FormData) {
  const supplier = text(form, "supplier_id"),
    amount = number(form, "quantity") * number(form, "unit_price");
  const quotes = [
    {
      supplier_id: supplier,
      amount,
      reference: text(form, "quote_reference") || undefined,
    },
    ...[2, 3]
      .map((index) => ({
        supplier_id: text(form, `quote_supplier_${index}`),
        amount: number(form, `quote_amount_${index}`),
        reference: text(form, `quote_reference_${index}`) || undefined,
      }))
      .filter((quote) => quote.supplier_id && quote.amount >= 0),
  ];
  await run(
    "procurement/purchase-orders",
    "POST",
    {
      supplier_id: supplier,
      destination_location_id: text(form, "location_id"),
      currency: text(form, "currency"),
      expected_on: text(form, "expected_on") || undefined,
      notes: text(form, "notes") || undefined,
      replenishment_request_ids: form
        .getAll("replenishment_request_ids")
        .map(String),
      quotes,
      lines: [
        {
          product_id: text(form, "product_id"),
          quantity: number(form, "quantity"),
          unit_price: number(form, "unit_price"),
          tax_amount: number(form, "tax_amount") || 0,
        },
      ],
    },
    "order-created",
  );
}
export async function actPurchaseOrderAction(form: FormData) {
  await run(
    `procurement/purchase-orders/${text(form, "id")}/actions`,
    "POST",
    {
      action: text(form, "action"),
      expected_version: number(form, "version"),
      reason: text(form, "reason") || "Decisão de compra registrada.",
    },
    "updated",
  );
}
export async function receivePurchaseOrderAction(form: FormData) {
  await run(
    `procurement/purchase-orders/${text(form, "id")}/receipts`,
    "POST",
    {
      expected_version: number(form, "version"),
      occurred_at: new Date().toISOString(),
      reference_code: text(form, "reference_code") || undefined,
      notes: text(form, "notes") || undefined,
      idempotency_key: crypto.randomUUID(),
      lines: [
        {
          order_line_id: text(form, "order_line_id"),
          accepted_quantity: number(form, "accepted_quantity"),
          rejected_quantity: number(form, "rejected_quantity") || 0,
          unit_cost: number(form, "unit_cost"),
          lot_code: text(form, "lot_code") || undefined,
          expires_on: text(form, "expires_on") || undefined,
          evidence_path: text(form, "evidence_path") || undefined,
        },
      ],
    },
    "receipt-created",
  );
}
export async function createProcurementInvoiceAction(form: FormData) {
  await run(
    "procurement/invoices",
    "POST",
    {
      purchase_order_id: text(form, "purchase_order_id"),
      invoice_number: text(form, "invoice_number"),
      issued_on: text(form, "issued_on"),
      due_dates: form.getAll("due_dates").map(String).filter(Boolean),
      total_amount: number(form, "total_amount"),
      evidence_path: text(form, "evidence_path") || undefined,
      idempotency_key: crypto.randomUUID(),
    },
    "invoice-created",
  );
}
export async function actProcurementInvoiceAction(form: FormData) {
  await run(
    `procurement/invoices/${text(form, "id")}/actions`,
    "POST",
    {
      action: text(form, "action"),
      expected_version: number(form, "version"),
      reason: text(form, "reason"),
    },
    "invoice-updated",
  );
}
export async function payProcurementInstallmentAction(form: FormData) {
  const tenders = [
    {
      payment_method: text(form, "payment_method"),
      amount: number(form, "amount"),
      reference_code: text(form, "reference_code") || undefined,
    },
  ];
  if (text(form, "payment_method_2") && number(form, "amount_2") > 0)
    tenders.push({
      payment_method: text(form, "payment_method_2"),
      amount: number(form, "amount_2"),
      reference_code: text(form, "reference_code_2") || undefined,
    });
  await run(
    `procurement/payables/${text(form, "id")}/payments`,
    "POST",
    {
      expected_version: number(form, "invoice_version"),
      idempotency_key: crypto.randomUUID(),
      cash_session_id: text(form, "cash_session_id") || undefined,
      tenders,
      notes: text(form, "notes") || undefined,
    },
    "payment-created",
  );
}
