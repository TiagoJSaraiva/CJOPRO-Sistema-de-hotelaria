"use server";

import { LOGIN_PAGE_ERROR_PARAM } from "@hotel/shared";
import { redirect } from "next/navigation";
import {
  loginWithCredentials,
  saveSessionCookie,
  SessionTooLargeError,
} from "../../lib/auth";
import {
  getActiveHotelCookieValue,
  resolveActiveHotelForUser,
  saveActiveHotelCookie,
} from "../../lib/activeHotel";

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect(`/login?error=${LOGIN_PAGE_ERROR_PARAM.MISSING_FIELDS}`);
  }

  try {
    const result = await loginWithCredentials(email, password);
    await saveSessionCookie(result.token, result.expiresIn);
    const preferredHotelId = await getActiveHotelCookieValue();
    const resolvedActiveHotelId = resolveActiveHotelForUser(
      result.user,
      preferredHotelId,
    );
    await saveActiveHotelCookie(resolvedActiveHotelId);
  } catch (error) {
    if (error instanceof SessionTooLargeError) {
      redirect(`/login?error=${LOGIN_PAGE_ERROR_PARAM.SESSION_TOO_LARGE}`);
    }
    redirect(`/login?error=${LOGIN_PAGE_ERROR_PARAM.INVALID_CREDENTIALS}`);
  }

  redirect("/dashboard");
}
