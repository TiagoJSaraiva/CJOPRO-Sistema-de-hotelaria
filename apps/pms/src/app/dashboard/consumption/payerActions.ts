"use server";

import { revalidatePath } from "next/cache";
import type {
  StayPayerAllocationInput,
  StayPayerPaymentInput,
} from "@hotel/shared";
import {
  assignStayPayerAllocations,
  createStayPayerPayment,
} from "../../../lib/adminApi";

export async function allocatePayersAction(
  stayId: string,
  input: StayPayerAllocationInput,
) {
  try {
    await assignStayPayerAllocations(stayId, input);
    revalidatePath(`/dashboard/reservations/account?stay_id=${stayId}`);
    return { ok: true, error: null };
  } catch (cause) {
    return { ok: false, error: (cause as Error).message };
  }
}
export async function payPayerAction(
  stayId: string,
  input: StayPayerPaymentInput,
) {
  try {
    await createStayPayerPayment(stayId, input);
    revalidatePath(`/dashboard/reservations/account?stay_id=${stayId}`);
    return { ok: true, error: null };
  } catch (cause) {
    return { ok: false, error: (cause as Error).message };
  }
}
