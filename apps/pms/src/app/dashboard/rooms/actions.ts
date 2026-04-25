"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@hotel/shared";
import { createRoom, deleteRoom, updateRoom } from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

function revalidateRoomPage(): void {
  revalidatePath("/dashboard/rooms");
  revalidatePath("/dashboard/rooms/create");
  revalidatePath("/dashboard/rooms/view");
}

function redirectWithStatus(status: string, section: "create" | "view" | "root" = "root"): never {
  const nonce = Date.now().toString(36);

  if (section === "root") {
    redirect(`/dashboard/rooms?status=${status}&r=${nonce}`);
  }

  redirect(`/dashboard/rooms/${section}?status=${status}&r=${nonce}`);
}

export async function createRoomAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.ROOM_CREATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.ROOM_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const roomNumber = String(formData.get("room_number") || "").trim();
  const roomType = String(formData.get("room_type") || "").trim();
  const maxOccupancy = Number(formData.get("max_occupancy") || "0");
  const baseDailyRate = Number(formData.get("base_daily_rate") || "0");
  const status = String(formData.get("status") || "available").trim();
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!roomNumber || !roomType || !Number.isFinite(maxOccupancy) || maxOccupancy <= 0 || !Number.isFinite(baseDailyRate) || baseDailyRate < 0) {
    redirectWithStatus("create_missing_fields", "create");
  }

  try {
    await createRoom({
      room_number: roomNumber,
      room_type: roomType,
      max_occupancy: maxOccupancy,
      base_daily_rate: baseDailyRate,
      status: status as "available" | "occupied" | "maintenance" | "blocked",
      notes
    });
  } catch {
    redirectWithStatus("create_error", "create");
  }

  revalidateRoomPage();
  redirectWithStatus("created", "create");
}

export async function updateRoomAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.ROOM_UPDATE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.ROOM_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();
  const roomNumber = String(formData.get("room_number") || "").trim();
  const roomType = String(formData.get("room_type") || "").trim();
  const maxOccupancy = Number(formData.get("max_occupancy") || "0");
  const baseDailyRate = Number(formData.get("base_daily_rate") || "0");
  const status = String(formData.get("status") || "available").trim();
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!id || !roomNumber || !roomType || !Number.isFinite(maxOccupancy) || !Number.isFinite(baseDailyRate)) {
    redirectWithStatus("update_missing_fields", "view");
  }

  try {
    await updateRoom(id, {
      room_number: roomNumber,
      room_type: roomType,
      max_occupancy: maxOccupancy,
      base_daily_rate: baseDailyRate,
      status: status as "available" | "occupied" | "maintenance" | "blocked",
      notes
    });
  } catch {
    redirectWithStatus("update_error", "view");
  }

  revalidateRoomPage();
  redirectWithStatus("updated", "view");
}

export async function deleteRoomAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.ROOM_DELETE)) {
    const fallback = user?.permissions.includes(PERMISSIONS.ROOM_READ) ? "view" : "root";
    redirectWithStatus("forbidden", fallback);
  }

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirectWithStatus("delete_missing_id", "view");
  }

  try {
    await deleteRoom(id);
  } catch {
    redirectWithStatus("delete_error", "view");
  }

  revalidateRoomPage();
  redirectWithStatus("deleted", "view");
}
