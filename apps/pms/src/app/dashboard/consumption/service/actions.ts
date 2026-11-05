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
import { readHotelInstant } from "../../../../lib/hotelClock";

export async function createServiceOrderAction(
  input: ConsumptionServiceOrderCreate,
) {
  try {
    await createConsumptionServiceOrder(
      input.expected_at
        ? {
            ...input,
            expected_at: await readHotelInstant(input.expected_at),
          }
        : input,
    );
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
