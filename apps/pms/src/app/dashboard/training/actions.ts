"use server";

import type { TrainingClockAction } from "@hotel/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestOperationsFinanceEndpoint } from "../../../lib/adminApi";
import { failureStatus } from "../_components/operationOutcome";

const value = (form: FormData, key: string) =>
  String(form.get(key) || "").trim();

export async function actTrainingClockAction(form: FormData) {
  const action = value(form, "action") as TrainingClockAction["action"];
  const localAtInput = value(form, "local_at");
  const input: TrainingClockAction = {
    action,
    expected_version: Number(form.get("expected_version")),
    reason: value(form, "reason") || `Ação local de treinamento: ${action}`,
    ...(action === "set" && localAtInput ? { local_at: localAtInput } : {}),
    ...(action === "advance"
      ? {
          amount: Number(form.get("amount")),
          unit: value(form, "unit") as "hours" | "days",
        }
      : {}),
  };
  try {
    await requestOperationsFinanceEndpoint(
      "training/clock/actions",
      "POST",
      input,
    );
  } catch (error) {
    redirect(`/dashboard/training?status=${failureStatus(error)}`);
  }
  revalidatePath("/dashboard/training");
  redirect("/dashboard/training?status=training-clock-updated");
}
