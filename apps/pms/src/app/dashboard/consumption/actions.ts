"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PERMISSIONS,
  type AdminConsumptionOfferPolicyInput,
  type ConsumptionBillingMode,
} from "@hotel/shared";
import {
  createConsumptionOffers,
  createConsumptionPoint,
  reorderConsumptionPoints,
  reorderConsumptionOffers,
  setConsumptionOfferArchived,
  setConsumptionPointArchived,
  updateConsumptionOffer,
  updateConsumptionPoint,
} from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function refresh() {
  revalidatePath("/dashboard/consumption");
  revalidatePath("/dashboard/consumption/points");
  revalidatePath("/dashboard/consumption/offers");
  revalidatePath("/dashboard/products/view");
}

function go(status: string, section: "points" | "offers"): never {
  redirect(
    `/dashboard/consumption/${section}?status=${encodeURIComponent(status)}&r=${Date.now().toString(36)}`,
  );
}

async function requireManage(section: "points" | "offers") {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(PERMISSIONS.CONSUMPTION_SETTINGS_MANAGE))
    go("forbidden", section);
}

function modes(
  formData: FormData,
  allowPartnerDirect = false,
): ConsumptionBillingMode[] | null {
  const result = formData
    .getAll("allowed_modes")
    .map(String)
    .filter((mode): mode is ConsumptionBillingMode =>
      [
        "hotel_immediate",
        "stay_folio",
        ...(allowPartnerDirect ? ["partner_direct"] : []),
      ].includes(mode),
    );
  return result.length && new Set(result).size === result.length
    ? result
    : null;
}

function policy(formData: FormData): AdminConsumptionOfferPolicyInput | null {
  if (formData.get("policy_source") !== "override")
    return { source: "inherit" };
  const allowedModes = modes(formData, true);
  const defaultMode = String(
    formData.get("default_mode") || "",
  ) as ConsumptionBillingMode;
  return allowedModes?.includes(defaultMode)
    ? {
        source: "override",
        allowed_modes: allowedModes,
        default_mode: defaultMode,
      }
    : null;
}

export async function createConsumptionPointAction(formData: FormData) {
  await requireManage("points");
  const name = String(formData.get("name") || "").trim();
  const allowedModes = modes(formData);
  const defaultMode = String(
    formData.get("default_mode") || "",
  ) as ConsumptionBillingMode;
  if (!name || !allowedModes?.includes(defaultMode)) go("invalid", "points");
  try {
    await createConsumptionPoint({
      name,
      internal_code: String(formData.get("internal_code") || "").trim() || null,
      description: String(formData.get("description") || "").trim() || null,
      is_active: true,
      default_policy: {
        allowed_modes: allowedModes,
        default_mode: defaultMode,
      },
      default_inventory_location_id:
        String(formData.get("default_inventory_location_id") || "").trim() ||
        null,
    });
  } catch {
    go("conflict", "points");
  }
  refresh();
  go("created", "points");
}

export async function updateConsumptionPointAction(formData: FormData) {
  await requireManage("points");
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const allowedModes = modes(formData);
  const defaultMode = String(
    formData.get("default_mode") || "",
  ) as ConsumptionBillingMode;
  if (!id || !name || !allowedModes?.includes(defaultMode))
    go("invalid", "points");
  try {
    await updateConsumptionPoint(id, {
      name,
      internal_code: String(formData.get("internal_code") || "").trim() || null,
      description: String(formData.get("description") || "").trim() || null,
      is_active: formData.get("is_active") === "on",
      default_policy: {
        allowed_modes: allowedModes,
        default_mode: defaultMode,
      },
      default_inventory_location_id:
        String(formData.get("default_inventory_location_id") || "").trim() ||
        null,
    });
  } catch {
    go("conflict", "points");
  }
  refresh();
  go("updated", "points");
}

export async function archiveConsumptionPointAction(formData: FormData) {
  await requireManage("points");
  const id = String(formData.get("id") || "").trim();
  if (!id) go("invalid", "points");
  try {
    await setConsumptionPointArchived(id, formData.get("archived") === "true");
  } catch {
    go("conflict", "points");
  }
  refresh();
  go("updated", "points");
}

export async function reorderConsumptionPointsAction(formData: FormData) {
  await requireManage("points");
  const ids = String(formData.get("ids") || "")
    .split(",")
    .filter(Boolean);
  const id = String(formData.get("id") || "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) go("invalid", "points");
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  try {
    await reorderConsumptionPoints({ ids });
  } catch {
    go("conflict", "points");
  }
  refresh();
  go("reordered", "points");
}

export async function createConsumptionOffersAction(formData: FormData) {
  await requireManage("offers");
  const pointId = String(formData.get("point_id") || "").trim();
  const productIds = formData.getAll("product_ids").map(String).filter(Boolean);
  const parsedPolicy = policy(formData);
  if (!pointId || !productIds.length || !parsedPolicy) go("invalid", "offers");
  try {
    await createConsumptionOffers(pointId, {
      product_ids: productIds,
      policy: parsedPolicy,
      commercial_agreement_id:
        String(formData.get("commercial_agreement_id") || "").trim() || null,
      inventory_location_id:
        String(formData.get("inventory_location_id") || "").trim() || null,
    });
  } catch {
    go("conflict", "offers");
  }
  refresh();
  go("created", "offers");
}

export async function updateConsumptionOfferAction(formData: FormData) {
  await requireManage("offers");
  const id = String(formData.get("id") || "").trim();
  const parsedPolicy = policy(formData);
  if (!id || !parsedPolicy) go("invalid", "offers");
  try {
    await updateConsumptionOffer(id, {
      is_active: formData.get("is_active") === "on",
      policy: parsedPolicy,
      commercial_agreement_id:
        String(formData.get("commercial_agreement_id") || "").trim() || null,
      inventory_location_id:
        String(formData.get("inventory_location_id") || "").trim() || null,
    });
  } catch {
    go("conflict", "offers");
  }
  refresh();
  go("updated", "offers");
}

export async function archiveConsumptionOfferAction(formData: FormData) {
  await requireManage("offers");
  const id = String(formData.get("id") || "").trim();
  if (!id) go("invalid", "offers");
  try {
    await setConsumptionOfferArchived(id, formData.get("archived") === "true");
  } catch {
    go("conflict", "offers");
  }
  refresh();
  go("updated", "offers");
}

export async function reorderConsumptionOffersAction(formData: FormData) {
  await requireManage("offers");
  const ids = String(formData.get("ids") || "")
    .split(",")
    .filter(Boolean);
  const pointId = String(formData.get("point_id") || "").trim();
  const id = String(formData.get("id") || "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const index = ids.indexOf(id);
  const target = index + direction;
  if (!pointId || index < 0 || target < 0 || target >= ids.length)
    go("invalid", "offers");
  [ids[index], ids[target]] = [ids[target]!, ids[index]!];
  try {
    await reorderConsumptionOffers(pointId, { ids });
  } catch {
    go("conflict", "offers");
  }
  refresh();
  go("reordered", "offers");
}
