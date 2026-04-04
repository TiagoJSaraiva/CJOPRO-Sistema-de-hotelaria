"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie } from "../../lib/auth";

export async function logoutAction(): Promise<void> {
  clearSessionCookie();
  redirect("/login");
}
