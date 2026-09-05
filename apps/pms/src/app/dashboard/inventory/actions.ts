"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS, type InventoryDocumentKind } from "@hotel/shared";
import { getUserFromSession } from "../../../lib/auth";
import {
  cancelInventoryCount,
  completeInventoryCount,
  createInventoryCount,
  createInventoryLocation,
  createInventoryPosition,
  postInventoryDocument,
  reorderInventoryLocations,
  setInventoryLocationArchived,
  transferInventory,
  updateInventoryCount,
  updateInventoryPosition,
  updateInventorySettings,
} from "../../../lib/adminApi";

type Tab = "overview" | "movements" | "counts" | "settings";
function go(tab: Tab, status: string): never {
  redirect(
    `/dashboard/inventory/${tab}?status=${encodeURIComponent(status)}&r=${Date.now().toString(36)}`,
  );
}
function refresh() {
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/consumption");
  revalidatePath("/dashboard/products");
}
async function requirePermission(permission: string, tab: Tab) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(permission)) go(tab, "forbidden");
}
function integer(form: FormData, name: string, fallback = 0) {
  const value = Number(form.get(name) ?? fallback);
  return Number.isInteger(value) && value >= 0 ? value : null;
}
function uuid() {
  return crypto.randomUUID();
}

export async function updateInventoryPolicyAction(formData: FormData) {
  await requirePermission(PERMISSIONS.INVENTORY_SETTINGS_MANAGE, "settings");
  const policy = String(formData.get("policy"));
  if (!(["allow_with_warning", "block"] as string[]).includes(policy))
    go("settings", "invalid");
  try {
    await updateInventorySettings(policy as "allow_with_warning" | "block");
  } catch {
    go("settings", "conflict");
  }
  refresh();
  go("settings", "updated");
}
export async function createInventoryLocationAction(formData: FormData) {
  await requirePermission(PERMISSIONS.INVENTORY_SETTINGS_MANAGE, "settings");
  const name = String(formData.get("name") || "").trim();
  if (!name) go("settings", "invalid");
  try {
    await createInventoryLocation({
      name,
      internal_code: String(formData.get("internal_code") || "").trim() || null,
      description: String(formData.get("description") || "").trim() || null,
      is_active: true,
    });
  } catch {
    go("settings", "conflict");
  }
  refresh();
  go("settings", "created");
}
export async function archiveInventoryLocationAction(formData: FormData) {
  await requirePermission(PERMISSIONS.INVENTORY_SETTINGS_MANAGE, "settings");
  const id = String(formData.get("id") || "");
  if (!id) go("settings", "invalid");
  try {
    await setInventoryLocationArchived(id, formData.get("archived") === "true");
  } catch {
    go("settings", "in-use");
  }
  refresh();
  go("settings", "updated");
}
export async function reorderInventoryLocationsAction(formData: FormData) {
  await requirePermission(PERMISSIONS.INVENTORY_SETTINGS_MANAGE, "settings");
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (!ids.length || new Set(ids).size !== ids.length)
    go("settings", "invalid");
  try {
    await reorderInventoryLocations(ids);
  } catch {
    go("settings", "conflict");
  }
  refresh();
  go("settings", "updated");
}
export async function createInventoryPositionAction(formData: FormData) {
  await requirePermission(PERMISSIONS.INVENTORY_SETTINGS_MANAGE, "settings");
  const initial = integer(formData, "initial_quantity"),
    minimum = integer(formData, "minimum_quantity"),
    ideal = integer(formData, "ideal_quantity");
  const productId = String(formData.get("product_id") || ""),
    locationId = String(formData.get("location_id") || "");
  const rawCost = String(formData.get("average_unit_cost") || "").trim();
  const cost = rawCost ? Number(rawCost) : null;
  if (
    !productId ||
    !locationId ||
    initial == null ||
    minimum == null ||
    ideal == null ||
    ideal < minimum ||
    (cost != null && (!Number.isFinite(cost) || cost < 0))
  )
    go("settings", "invalid");
  try {
    await createInventoryPosition({
      product_id: productId,
      location_id: locationId,
      initial_quantity: initial,
      minimum_quantity: minimum,
      ideal_quantity: ideal,
      average_unit_cost: cost,
      idempotency_key: uuid(),
    });
  } catch {
    go("settings", "ineligible");
  }
  refresh();
  go("settings", "enabled");
}
export async function updateInventoryPositionAction(formData: FormData) {
  await requirePermission(PERMISSIONS.INVENTORY_SETTINGS_MANAGE, "overview");
  const id = String(formData.get("id") || ""),
    minimum = integer(formData, "minimum_quantity"),
    ideal = integer(formData, "ideal_quantity");
  if (!id || minimum == null || ideal == null || ideal < minimum)
    go("overview", "invalid");
  try {
    await updateInventoryPosition(id, {
      minimum_quantity: minimum,
      ideal_quantity: ideal,
      is_active: formData.get("is_active") === "on",
    });
  } catch {
    go("overview", "conflict");
  }
  refresh();
  go("overview", "updated");
}
export async function postInventoryDocumentAction(formData: FormData) {
  await requirePermission(PERMISSIONS.INVENTORY_MOVEMENTS_POST, "movements");
  const kind = String(formData.get("kind")) as InventoryDocumentKind;
  const positionId = String(formData.get("position_id") || ""),
    quantity = integer(formData, "quantity"),
    reason = String(formData.get("reason") || "").trim();
  const rawCost = String(formData.get("unit_cost") || "").trim();
  const unitCost = rawCost ? Number(rawCost) : null;
  if (
    !(
      kind === "receipt" ||
      kind === "adjustment" ||
      kind === "loss" ||
      kind === "internal_use"
    ) ||
    !positionId ||
    quantity == null ||
    quantity < 1 ||
    reason.length < 3 ||
    (unitCost != null && unitCost < 0)
  )
    go("movements", "invalid");
  try {
    await postInventoryDocument({
      kind,
      direction:
        kind === "adjustment"
          ? (String(formData.get("direction")) as "in" | "out")
          : undefined,
      reason,
      reference_code:
        String(formData.get("reference_code") || "").trim() || null,
      occurred_at: new Date().toISOString(),
      idempotency_key: uuid(),
      lines: [{ position_id: positionId, quantity, unit_cost: unitCost }],
    });
  } catch {
    go("movements", "conflict");
  }
  refresh();
  go("movements", "posted");
}
export async function transferInventoryAction(formData: FormData) {
  await requirePermission(PERMISSIONS.INVENTORY_MOVEMENTS_POST, "movements");
  const quantity = integer(formData, "quantity"),
    source = String(formData.get("source_location_id") || ""),
    destination = String(formData.get("destination_location_id") || ""),
    product = String(formData.get("product_id") || ""),
    reason = String(formData.get("reason") || "").trim();
  if (
    !source ||
    !destination ||
    source === destination ||
    !product ||
    quantity == null ||
    quantity < 1 ||
    reason.length < 3
  )
    go("movements", "invalid");
  try {
    await transferInventory({
      source_location_id: source,
      destination_location_id: destination,
      product_id: product,
      quantity,
      reason,
      reference_code: null,
      occurred_at: new Date().toISOString(),
      idempotency_key: uuid(),
    });
  } catch {
    go("movements", "conflict");
  }
  refresh();
  go("movements", "transferred");
}
export async function createInventoryCountAction(formData: FormData) {
  await requirePermission(PERMISSIONS.INVENTORY_COUNTS_PERFORM, "counts");
  const location = String(formData.get("location_id") || "");
  if (!location) go("counts", "invalid");
  try {
    await createInventoryCount({
      location_id: location,
      notes: String(formData.get("notes") || "").trim() || null,
      idempotency_key: uuid(),
    });
  } catch {
    go("counts", "conflict");
  }
  refresh();
  go("counts", "created");
}
export async function updateInventoryCountAction(formData: FormData) {
  await requirePermission(PERMISSIONS.INVENTORY_COUNTS_PERFORM, "counts");
  const countId = String(formData.get("count_id") || ""),
    itemId = String(formData.get("item_id") || ""),
    counted = integer(formData, "counted_quantity");
  if (!countId || !itemId || counted == null) go("counts", "invalid");
  try {
    await updateInventoryCount(countId, {
      items: [{ item_id: itemId, counted_quantity: counted }],
    });
  } catch {
    go("counts", "conflict");
  }
  refresh();
  go("counts", "updated");
}
export async function finishInventoryCountAction(formData: FormData) {
  await requirePermission(PERMISSIONS.INVENTORY_COUNTS_PERFORM, "counts");
  const id = String(formData.get("id") || "");
  if (!id) go("counts", "invalid");
  try {
    if (formData.get("action") === "cancel") await cancelInventoryCount(id);
    else await completeInventoryCount(id);
  } catch {
    go("counts", "concurrent");
  }
  refresh();
  go("counts", "updated");
}
