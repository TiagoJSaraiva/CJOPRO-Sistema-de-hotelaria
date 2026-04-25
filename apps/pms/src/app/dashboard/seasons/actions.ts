"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createSeason, deleteSeason, updateSeason } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidateSeasonPage(): void {
  revalidatePath("/dashboard/seasons");
  revalidatePath("/dashboard/seasons/create");
  revalidatePath("/dashboard/seasons/view");
}

function redirectWithStatus(status: string, section: "create" | "view" | "root" = "root"): never {
  const nonce = Date.now().toString(36);

  if (section === "root") {
    redirect(`/dashboard/seasons?status=${status}&r=${nonce}`);
  }

  redirect(`/dashboard/seasons/${section}?status=${status}&r=${nonce}`);
}

export async function createSeasonAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.SEASON_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.SEASON_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("start_date") || "").trim();
  const endDate = String(formData.get("end_date") || "").trim();
  if (!name || !startDate || !endDate) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createSeason({
      name,
      start_date: startDate,
      end_date: endDate,
      is_active: formData.get("is_active") === "on"
    });
  } catch {
    redirectWithStatus("create_error", "create");
  }

  revalidateSeasonPage();
  redirectWithStatus("created", "create");
}

export async function updateSeasonAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.SEASON_UPDATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.SEASON_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("start_date") || "").trim();
  const endDate = String(formData.get("end_date") || "").trim();
  if (!id || !name || !startDate || !endDate) {
    redirectWithStatus("update_missing_fields", "view");
  }

  try {
    await updateSeason(id, {
      name,
      start_date: startDate,
      end_date: endDate,
      is_active: formData.get("is_active") === "on"
    });
  } catch {
    redirectWithStatus("update_error", "view");
  }

  revalidateSeasonPage();
  redirectWithStatus("updated", "view");
}

export async function deleteSeasonAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.SEASON_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.SEASON_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("delete_missing_id", "view");
  }

  try {
    await deleteSeason(id);
  } catch {
    redirectWithStatus("delete_error", "view");
  }

  revalidateSeasonPage();
  redirectWithStatus("deleted", "view");
}
