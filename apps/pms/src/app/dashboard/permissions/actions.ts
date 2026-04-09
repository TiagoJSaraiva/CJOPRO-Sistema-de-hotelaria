"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createPermission, deletePermission, updatePermission } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidatePermissionPages(): void {
  revalidatePath("/dashboard/permissions");
  revalidatePath("/dashboard/permissions/create");
  revalidatePath("/dashboard/permissions/view");
}

function redirectWithStatus(status: string, section: "create" | "view" | "root" = "root"): never {
  if (section === "root") {
    redirect(`/dashboard/permissions?status=${status}`);
  }

  redirect(`/dashboard/permissions/${section}?status=${status}`);
}

export async function createPermissionAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.PERMISSION_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.PERMISSION_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const name = String(formData.get("name") || "").trim();

  if (!name) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createPermission({ name });
  } catch {
    redirectWithStatus("create_error", "create");
  }

  revalidatePermissionPages();
  redirectWithStatus("created", "create");
}

export async function updatePermissionAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.PERMISSION_UPDATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.PERMISSION_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();

  if (!id || !name) {
    redirectWithStatus("update_missing_fields", "view");
  }

  try {
    await updatePermission(id, { name });
  } catch {
    redirectWithStatus("update_error", "view");
  }

  revalidatePermissionPages();
  redirectWithStatus("updated", "view");
}

export async function deletePermissionAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.PERMISSION_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.PERMISSION_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("delete_missing_id", "view");
  }

  try {
    await deletePermission(id);
  } catch {
    redirectWithStatus("delete_error", "view");
  }

  revalidatePermissionPages();
  redirectWithStatus("deleted", "view");
}
