"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createSeasonRoomRate, deleteSeasonRoomRate, updateSeasonRoomRate } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidateSeasonRoomRatesPage(): void {
  revalidatePath("/dashboard/season-room-rates");
  revalidatePath("/dashboard/season-room-rates/create");
  revalidatePath("/dashboard/season-room-rates/view");
}

function redirectWithStatus(status: string, section: "create" | "view" | "root" = "root"): never {
  const nonce = Date.now().toString(36);

  if (section === "root") {
    redirect(`/dashboard/season-room-rates?status=${status}&r=${nonce}`);
  }

  redirect(`/dashboard/season-room-rates/${section}?status=${status}&r=${nonce}`);
}

export async function createSeasonRoomRateAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const seasonId = String(formData.get("season_id") || "").trim();
  const roomType = String(formData.get("room_type") || "").trim();
  const dailyRate = Number(formData.get("daily_rate") || "0");
  if (!seasonId || !roomType || !Number.isFinite(dailyRate) || dailyRate < 0) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createSeasonRoomRate({ season_id: seasonId, room_type: roomType, daily_rate: dailyRate });
  } catch {
    redirectWithStatus("create_error", "create");
  }

  revalidateSeasonRoomRatesPage();
  redirectWithStatus("created", "create");
}

export async function updateSeasonRoomRateAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_UPDATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  const seasonId = String(formData.get("season_id") || "").trim();
  const roomType = String(formData.get("room_type") || "").trim();
  const dailyRate = Number(formData.get("daily_rate") || "0");
  if (!id || !seasonId || !roomType || !Number.isFinite(dailyRate)) {
    redirectWithStatus("update_missing_fields", "view");
  }

  try {
    await updateSeasonRoomRate(id, { season_id: seasonId, room_type: roomType, daily_rate: dailyRate });
  } catch {
    redirectWithStatus("update_error", "view");
  }

  revalidateSeasonRoomRatesPage();
  redirectWithStatus("updated", "view");
}

export async function deleteSeasonRoomRateAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("delete_missing_id", "view");
  }

  try {
    await deleteSeasonRoomRate(id);
  } catch {
    redirectWithStatus("delete_error", "view");
  }

  revalidateSeasonRoomRatesPage();
  redirectWithStatus("deleted", "view");
}
