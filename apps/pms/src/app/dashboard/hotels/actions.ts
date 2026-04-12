"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createHotel, deleteHotel, updateHotel, type AdminHotelCreateInput, type AdminHotelUpdateInput } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function sanitizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toOptionalText(value: FormDataEntryValue | null): string | null {
  const parsed = String(value || "").trim();
  return parsed.length ? parsed : null;
}

function revalidateHotelPages(): void {
  revalidatePath("/dashboard/hotels");
  revalidatePath("/dashboard/hotels/create");
  revalidatePath("/dashboard/hotels/view");
}

function getRedirectNonce(): string {
  return Date.now().toString(36);
}

function parseCreateHotelPayload(formData: FormData): AdminHotelCreateInput {
  return {
    name: String(formData.get("name") || "").trim(),
    legal_name: String(formData.get("legal_name") || "").trim(),
    tax_id: sanitizeDigits(String(formData.get("tax_id") || "")),
    slug: normalizeSlug(String(formData.get("slug") || "")),
    email: normalizeEmail(String(formData.get("email") || "")),
    phone: sanitizeDigits(String(formData.get("phone") || "")),
    address_line: String(formData.get("address_line") || "").trim(),
    address_number: String(formData.get("address_number") || "").trim(),
    address_complement: toOptionalText(formData.get("address_complement")),
    district: String(formData.get("district") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    state: String(formData.get("state") || "").trim(),
    country: String(formData.get("country") || "").trim().toUpperCase(),
    zip_code: String(formData.get("zip_code") || "").trim(),
    timezone: toOptionalText(formData.get("timezone")),
    currency: toOptionalText(formData.get("currency"))?.toUpperCase() || null
  };
}

function parseUpdateHotelPayload(formData: FormData): AdminHotelUpdateInput {
  return {
    name: String(formData.get("name") || "").trim(),
    slug: normalizeSlug(String(formData.get("slug") || "")),
    city: toOptionalText(formData.get("city")),
    email: toOptionalText(formData.get("email"))?.toLowerCase() || null,
    is_active: formData.get("is_active") === "on"
  };
}

function redirectWithStatus(status: string, section: "create" | "view" | "root" = "root"): never {
  const nonce = getRedirectNonce();

  if (section === "root") {
    redirect(`/dashboard/hotels?status=${status}&r=${nonce}`);
  }

  redirect(`/dashboard/hotels/${section}?status=${status}&r=${nonce}`);
}

export async function createHotelAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.HOTEL_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.HOTEL_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const payload = parseCreateHotelPayload(formData);

  if (
    !payload.name ||
    !payload.legal_name ||
    !payload.tax_id ||
    !payload.email ||
    !payload.phone ||
    !payload.address_line ||
    !payload.address_number ||
    !payload.district ||
    !payload.city ||
    !payload.state ||
    !payload.country ||
    !payload.zip_code ||
    !payload.slug
  ) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createHotel(payload);
  } catch {
    redirectWithStatus("create_error", "create");
  }

  revalidateHotelPages();
  redirectWithStatus("created", "create");
}

export async function updateHotelAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.HOTEL_UPDATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.HOTEL_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  const payload = parseUpdateHotelPayload(formData);

  if (!id || !payload.name || !payload.slug) {
    redirectWithStatus("update_missing_fields", "view");
  }

  try {
    await updateHotel(id, payload);
  } catch {
    redirectWithStatus("update_error", "view");
  }

  revalidateHotelPages();
  redirectWithStatus("updated", "view");
}

export async function deleteHotelAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.HOTEL_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.HOTEL_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("delete_missing_id", "view");
  }

  try {
    await deleteHotel(id);
  } catch {
    redirectWithStatus("delete_error", "view");
  }

  revalidateHotelPages();
  redirectWithStatus("deleted", "view");
}
