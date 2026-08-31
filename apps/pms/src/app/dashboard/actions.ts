"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie } from "../../lib/auth";
import {
  decodeActiveHotelCookie,
  saveActiveHotelCookie,
  getActiveHotelCookieValue,
  resolveActiveHotelForUser,
  userCanAccessHotel,
  clearActiveHotelCookie,
} from "../../lib/activeHotel";
import { getUserFromSession } from "../../lib/auth";

export async function setActiveHotelAction(formData: FormData): Promise<void> {
  const user = await getUserFromSession();

  if (!user) {
    await clearActiveHotelCookie();
    return;
  }

  const requestedHotelId = decodeActiveHotelCookie(
    String(formData.get("hotelId") || ""),
  );
  const preferredHotelId = userCanAccessHotel(user, requestedHotelId ?? null)
    ? (requestedHotelId ?? null)
    : await getActiveHotelCookieValue();

  const resolvedActiveHotelId = resolveActiveHotelForUser(
    user,
    preferredHotelId,
  );
  await saveActiveHotelCookie(resolvedActiveHotelId);
}

export async function logoutAction(): Promise<void> {
  await clearActiveHotelCookie();
  await clearSessionCookie();
  redirect("/login");
}
