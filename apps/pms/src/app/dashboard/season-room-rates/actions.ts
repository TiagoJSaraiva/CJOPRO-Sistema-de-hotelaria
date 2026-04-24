"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createSeasonRoomRate, deleteSeasonRoomRate, updateSeasonRoomRate } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidateSeasonRoomRatesPage(): void {
  revalidatePath("/dashboard/season-room-rates");
}

function redirectWithStatus(status: string): never {
  redirect(`/dashboard/season-room-rates?status=${status}&r=${Date.now().toString(36)}`);
}

export async function createSeasonRoomRateAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_CREATE)) redirectWithStatus("forbidden");

  const seasonId = String(formData.get("season_id") || "").trim();
  const roomType = String(formData.get("room_type") || "").trim();
  const dailyRate = Number(formData.get("daily_rate") || "0");
  if (!seasonId || !roomType || !Number.isFinite(dailyRate) || dailyRate < 0) redirectWithStatus("create_missing_fields");

  try {
    await createSeasonRoomRate({ season_id: seasonId, room_type: roomType, daily_rate: dailyRate });
  } catch {
    redirectWithStatus("create_error");
  }

  revalidateSeasonRoomRatesPage();
  redirectWithStatus("created");
}

export async function updateSeasonRoomRateAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_UPDATE)) redirectWithStatus("forbidden");

  const id = String(formData.get("id") || "").trim();
  const seasonId = String(formData.get("season_id") || "").trim();
  const roomType = String(formData.get("room_type") || "").trim();
  const dailyRate = Number(formData.get("daily_rate") || "0");
  if (!id || !seasonId || !roomType || !Number.isFinite(dailyRate)) redirectWithStatus("update_missing_fields");

  try {
    await updateSeasonRoomRate(id, { season_id: seasonId, room_type: roomType, daily_rate: dailyRate });
  } catch {
    redirectWithStatus("update_error");
  }

  revalidateSeasonRoomRatesPage();
  redirectWithStatus("updated");
}

export async function deleteSeasonRoomRateAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();
  if (!user || !user.permissions.includes(PERMISSIONS.SEASON_ROOM_RATE_DELETE)) redirectWithStatus("forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) redirectWithStatus("delete_missing_id");

  try {
    await deleteSeasonRoomRate(id);
  } catch {
    redirectWithStatus("delete_error");
  }

  revalidateSeasonRoomRatesPage();
  redirectWithStatus("deleted");
}
