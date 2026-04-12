"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeEmail, PERMISSIONS, type AdminUserRoleAssignmentInput } from "@hotel/shared";
import { createUser, deleteUser, updateUser } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function normalizeRoleAssignments(rawValue: FormDataEntryValue | null): AdminUserRoleAssignmentInput[] {
  const rawText = String(rawValue || "").trim();

  if (!rawText) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawText) as Array<{ role_id?: string; hotel_id?: string | null }>;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ({
        role_id: String(item?.role_id || "").trim(),
        hotel_id: String(item?.hotel_id || "").trim() || null
      }))
      .filter((item) => item.role_id.length > 0);
  } catch {
    return [];
  }
}

function revalidateUserPages(): void {
  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/users/create");
  revalidatePath("/dashboard/users/view");
}

function getRedirectNonce(): string {
  return Date.now().toString(36);
}

function redirectWithStatus(status: string, section: "create" | "view" | "root" = "root"): never {
  const nonce = getRedirectNonce();

  if (section === "root") {
    redirect(`/dashboard/users?status=${status}&r=${nonce}`);
  }

  redirect(`/dashboard/users/${section}?status=${status}&r=${nonce}`);
}

export async function createUserAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.USER_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.USER_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const name = String(formData.get("name") || "").trim();
  const email = normalizeEmail(String(formData.get("email") || ""));
  const passwordHash = String(formData.get("password_hash") || "").trim();
  const roleAssignments = normalizeRoleAssignments(formData.get("role_assignments"));

  if (!name || !email || !passwordHash) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createUser({
      name,
      email,
      password_hash: passwordHash,
      role_assignments: roleAssignments
    });
  } catch {
    redirectWithStatus("create_error", "create");
  }

  revalidateUserPages();
  redirectWithStatus("created", "create");
}

export async function updateUserAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.USER_UPDATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.USER_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = normalizeEmail(String(formData.get("email") || ""));
  const passwordHash = String(formData.get("password_hash") || "").trim();
  const roleAssignments = normalizeRoleAssignments(formData.get("role_assignments"));

  if (!id || !name || !email) {
    redirectWithStatus("update_missing_fields", "view");
  }

  const payload: {
    name: string;
    email: string;
    role_assignments: AdminUserRoleAssignmentInput[];
    is_active: boolean;
    password_hash?: string;
  } = {
    name,
    email,
    role_assignments: roleAssignments,
    is_active: formData.get("is_active") === "on"
  };

  if (passwordHash) {
    payload.password_hash = passwordHash;
  }

  try {
    await updateUser(id, payload);
  } catch {
    redirectWithStatus("update_error", "view");
  }

  revalidateUserPages();
  redirectWithStatus("updated", "view");
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.USER_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.USER_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("delete_missing_id", "view");
  }

  try {
    await deleteUser(id);
  } catch {
    redirectWithStatus("delete_error", "view");
  }

  revalidateUserPages();
  redirectWithStatus("deleted", "view");
}
