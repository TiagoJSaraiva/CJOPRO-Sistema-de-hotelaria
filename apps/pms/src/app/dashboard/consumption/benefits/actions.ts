"use server";

import { revalidatePath } from "next/cache";
import {
  createConsumptionBenefitPlan,
  createConsumptionBenefitVersion,
} from "../../../../lib/adminApi";

export async function createBenefitPlanAction(formData: FormData) {
  await createConsumptionBenefitPlan({
    name: String(formData.get("name")),
    description: String(formData.get("description") || "") || undefined,
  });
  revalidatePath("/dashboard/consumption/benefits");
}

export async function createBenefitVersionAction(formData: FormData) {
  const targetKind = String(formData.get("target_kind"));
  const targetId = String(formData.get("target_id"));
  const target =
    targetKind === "product_id"
      ? { product_id: targetId }
      : targetKind === "offer_id"
        ? { offer_id: targetId }
        : targetKind === "point_id"
          ? { point_id: targetId }
          : { category_id: targetId };
  await createConsumptionBenefitVersion(String(formData.get("plan_id")), {
    allowance_scope: String(formData.get("allowance_scope")) as
      "stay" | "night" | "calendar_day",
    activate: true,
    rules: [
      {
        kind: "monetary_credit",
        amount: Number(formData.get("amount")),
        ...target,
      },
    ],
  });
  revalidatePath("/dashboard/consumption/benefits");
}
