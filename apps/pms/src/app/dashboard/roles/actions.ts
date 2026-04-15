"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_ROLE_TYPES, PERMISSIONS, type AdminRoleType } from "@hotel/shared";
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

function normalizeRoleType(rawValue: FormDataEntryValue | null): AdminRoleType | null {
  const parsed = String(rawValue || "").trim();

  if (parsed === ADMIN_ROLE_TYPES.SYSTEM || parsed === ADMIN_ROLE_TYPES.HOTEL) {
    return parsed;
  }

  return null;
}

function revalidateRolePages(): void {
  revalidatePath("/dashboard/roles");
  revalidatePath("/dashboard/roles/create");
  revalidatePath("/dashboard/roles/view");
}

function getRedirectNonce(): string {
  return Date.now().toString(36);
}

function redirectWithStatus(status: string, section: "create" | "view" | "root" = "root", detail?: string): never {
  const nonce = getRedirectNonce();
  const detailParam = detail ? `&detail=${encodeURIComponent(detail.slice(0, 220))}` : "";

  if (section === "root") {
    redirect(`/dashboard/roles?status=${status}${detailParam}&r=${nonce}`);
  }

  redirect(`/dashboard/roles/${section}?status=${status}${detailParam}&r=${nonce}`);
}

function isDeleteConflictError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = Number((error as { statusCode?: unknown }).statusCode);

    if (statusCode === 409) {
      return true;
    }
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("dependencias ativas") || message.includes("nao pode ser exclu");
}

function getErrorStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) {
    return null;
  }

  const parsed = Number((error as { statusCode?: unknown }).statusCode);
  return Number.isFinite(parsed) ? parsed : null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Falha inesperada ao comunicar com o backend.";
}

function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("fetch failed") || message.includes("failed to fetch") || message.includes("network");
}

export async function createRoleAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.ROLE_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.ROLE_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const name = String(formData.get("name") || "").trim();
  const roleType = normalizeRoleType(formData.get("role_type"));
  const hotelId = normalizeOptionalText(formData.get("hotel_id"));
  const permissionIds = normalizePermissionIds(formData.get("permission_ids"));

  if (!name || !roleType) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createRole({ name, role_type: roleType, hotel_id: hotelId, permission_ids: permissionIds });
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
  const roleType = normalizeRoleType(formData.get("role_type"));
  const hotelId = normalizeOptionalText(formData.get("hotel_id"));
  const permissionIds = normalizePermissionIds(formData.get("permission_ids"));

  if (!id || !name || !roleType) {
    redirectWithStatus("update_missing_fields", "view");
  }

  try {
    await updateRole(id, {
      name,
      role_type: roleType,
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
    console.warn("[roles/deleteRoleAction] id ausente no formData");
    redirectWithStatus("delete_missing_id", "view");
  }

  console.info("[roles/deleteRoleAction] iniciando exclusao", { id });

  try {
    await deleteRole(id);
  } catch (error) {
    const statusCode = getErrorStatusCode(error);
    const message = getErrorMessage(error);

    console.error("[roles/deleteRoleAction] falha ao excluir", {
      id,
      statusCode,
      message
    });

    if (statusCode === 404) {
      redirectWithStatus("delete_not_found", "view", message);
    }

    if (statusCode === 401 || statusCode === 403) {
      redirectWithStatus("forbidden", "view", message);
    }

    if (isDeleteConflictError(error)) {
      redirectWithStatus("delete_conflict", "view", message);
    }

    if (isNetworkError(error)) {
      redirectWithStatus("delete_error_network", "view", message);
    }

    redirectWithStatus("delete_error", "view", message);
  }

  revalidateRolePages();
  console.info("[roles/deleteRoleAction] exclusao concluida", { id });
  redirectWithStatus("deleted", "view");
}
