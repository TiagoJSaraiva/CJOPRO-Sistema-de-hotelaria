"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createRole, deleteRole, updateRole } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function normalizePermissionIds(rawValue: FormDataEntryValue | null): string[] {
  const rawText = String(rawValue || "").trim();

  if (!rawText) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawText) as string[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen = new Set<string>();

    return parsed
      .map((item) => String(item || "").trim())
      .filter((item) => {
        if (!item || seen.has(item)) {
          return false;
        }

        seen.add(item);
        return true;
      });
  } catch {
    return [];
  }
}

function normalizeOptionalText(rawValue: FormDataEntryValue | null): string | null {
  const parsed = String(rawValue || "").trim();
  return parsed.length ? parsed : null;
}

function revalidateRolePages(): void {
  revalidatePath("/dashboard/roles");
  revalidatePath("/dashboard/roles/create");
  revalidatePath("/dashboard/roles/view");
}

function redirectWithStatus(status: string, section: "create" | "view" | "root" = "root"): never {
  if (section === "root") {
    redirect(`/dashboard/roles?status=${status}`);
  }

  redirect(`/dashboard/roles/${section}?status=${status}`);
}

export async function createRoleAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.ROLE_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.ROLE_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const name = String(formData.get("name") || "").trim();
  const hotelId = normalizeOptionalText(formData.get("hotel_id"));
  const permissionIds = normalizePermissionIds(formData.get("permission_ids"));

  if (!name) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createRole({ name, hotel_id: hotelId, permission_ids: permissionIds });
  } catch {
    redirectWithStatus("create_error", "create");
  }

  revalidateRolePages();
  redirectWithStatus("created", "create");
}

export async function updateRoleAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.ROLE_UPDATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.ROLE_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const hotelId = normalizeOptionalText(formData.get("hotel_id"));
  const permissionIds = normalizePermissionIds(formData.get("permission_ids"));

  if (!id || !name) {
    redirectWithStatus("update_missing_fields", "view");
  }

  try {
    await updateRole(id, {
      name,
      hotel_id: hotelId,
      permission_ids: permissionIds
    });
  } catch {
    redirectWithStatus("update_error", "view");
  }

  revalidateRolePages();
  redirectWithStatus("updated", "view");
}

export async function deleteRoleAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.ROLE_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.ROLE_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("delete_missing_id", "view");
  }

  try {
    await deleteRole(id);
  } catch {
    redirectWithStatus("delete_error", "view");
  }

  revalidateRolePages();
  redirectWithStatus("deleted", "view");
}
