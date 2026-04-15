"use server";

import { LOGIN_PAGE_ERROR_PARAM } from "@hotel/shared";
import { redirect } from "next/navigation";
import { loginWithCredentials, saveSessionCookie } from "../../lib/auth";
import { getActiveHotelCookieValue, resolveActiveHotelForUser, saveActiveHotelCookie } from "../../lib/activeHotel";

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect(`/login?error=${LOGIN_PAGE_ERROR_PARAM.MISSING_FIELDS}`);
  }

  try {
    const result = await loginWithCredentials(email, password);
    saveSessionCookie(result.token, result.expiresIn);
    const preferredHotelId = getActiveHotelCookieValue();
    const resolvedActiveHotelId = resolveActiveHotelForUser(result.user, preferredHotelId);
    saveActiveHotelCookie(resolvedActiveHotelId);
  } catch {
    redirect(`/login?error=${LOGIN_PAGE_ERROR_PARAM.INVALID_CREDENTIALS}`);
  }

  redirect("/dashboard");
}
