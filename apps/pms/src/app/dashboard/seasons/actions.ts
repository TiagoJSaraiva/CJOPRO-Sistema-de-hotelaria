"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createSeason, deleteSeason, updateSeason } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidateSeasonPage(): void {
  revalidatePath("/dashboard/seasons");
}

function redirectWithStatus(status: string): never {
  redirect(`/dashboard/seasons?status=${status}&r=${Date.now().toString(36)}`);
}

export async function createSeasonAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.SEASON_CREATE)) redirectWithStatus("forbidden");

  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("start_date") || "").trim();
  const endDate = String(formData.get("end_date") || "").trim();
  if (!name || !startDate || !endDate) redirectWithStatus("create_missing_fields");

  try {
    await createSeason({
      name,
      start_date: startDate,
      end_date: endDate,
      is_active: formData.get("is_active") === "on"
    });
  } catch {
    redirectWithStatus("create_error");
  }

  revalidateSeasonPage();
  redirectWithStatus("created");
}

export async function updateSeasonAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.SEASON_UPDATE)) redirectWithStatus("forbidden");

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("start_date") || "").trim();
  const endDate = String(formData.get("end_date") || "").trim();
  if (!id || !name || !startDate || !endDate) redirectWithStatus("update_missing_fields");

  try {
    await updateSeason(id, {
      name,
      start_date: startDate,
      end_date: endDate,
      is_active: formData.get("is_active") === "on"
    });
  } catch {
    redirectWithStatus("update_error");
  }

  revalidateSeasonPage();
  redirectWithStatus("updated");
}

export async function deleteSeasonAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.SEASON_DELETE)) redirectWithStatus("forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) redirectWithStatus("delete_missing_id");

  try {
    await deleteSeason(id);
  } catch {
    redirectWithStatus("delete_error");
  }

  revalidateSeasonPage();
  redirectWithStatus("deleted");
}
