"use server";

import { revalidatePath } from "next/cache";
import type {
  ConsumptionServiceAction,
  ConsumptionServiceOrderCreate,
} from "@hotel/shared";
import {
  actConsumptionServiceOrder,
  createConsumptionServiceOrder,
} from "../../../../lib/adminApi";

export async function createServiceOrderAction(
  input: ConsumptionServiceOrderCreate,
) {
  try {
    await createConsumptionServiceOrder(input);
    revalidatePath("/dashboard/consumption/service");
    return { ok: true, error: null };
  } catch (cause) {
    return { ok: false, error: (cause as Error).message };
  }
}

export async function actServiceOrderAction(
  id: string,
  input: ConsumptionServiceAction,
) {
  try {
    await actConsumptionServiceOrder(id, input);
    revalidatePath("/dashboard/consumption/service");
    return { ok: true, error: null };
  } catch (cause) {
    return { ok: false, error: (cause as Error).message };
  }
}
