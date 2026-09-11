"use server";

import { redirect } from "next/navigation";
import { transferConsumption } from "../../../lib/adminApi";

export async function transferConsumptionAction(formData: FormData) {
  const orderId = String(formData.get("order_id"));
  const itemIds = formData.getAll("order_item_id").map(String);
  const quantities = formData.getAll("quantity").map(Number);
  await transferConsumption(orderId, {
    destination_stay_id: String(formData.get("destination_stay_id")),
    guest_customer_id: String(formData.get("guest_customer_id")),
    payer_account_id: String(formData.get("payer_account_id")),
    expected_source_version: Number(formData.get("expected_source_version")),
    expected_destination_version: Number(
      formData.get("expected_destination_version"),
    ),
    reason: String(formData.get("reason")),
    items: itemIds.map((order_item_id, index) => ({
      order_item_id,
      quantity: quantities[index] || 0,
    })),
  });
  redirect(`/dashboard/consumption/history?id=${orderId}&transfer=completed`);
}
