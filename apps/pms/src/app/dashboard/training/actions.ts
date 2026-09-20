"use server";

import type { TrainingClockAction } from "@hotel/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestOperationsFinanceEndpoint } from "../../../lib/adminApi";

const value = (form: FormData, key: string) =>
  String(form.get(key) || "").trim();

export async function actTrainingClockAction(form: FormData) {
  const action = value(form, "action") as TrainingClockAction["action"];
  const atInput = value(form, "at");
  const input: TrainingClockAction = {
    action,
    expected_version: Number(form.get("expected_version")),
    reason: value(form, "reason") || `Ação local de treinamento: ${action}`,
    ...(action === "set" && atInput
      ? { at: new Date(atInput).toISOString() }
      : {}),
    ...(action === "advance"
      ? {
          amount: Number(form.get("amount")),
          unit: value(form, "unit") as "hours" | "days",
        }
      : {}),
  };
  await requestOperationsFinanceEndpoint(
    "training/clock/actions",
    "POST",
    input,
  );
  revalidatePath("/dashboard/training");
  redirect(
    `/dashboard/training?status=${encodeURIComponent("Relógio operacional atualizado.")}`,
  );
}
