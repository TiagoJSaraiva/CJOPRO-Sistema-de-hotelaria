"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestOperationsFinanceEndpoint } from "../../../lib/adminApi";
const value = (f: FormData, n: string) => String(f.get(n) || "").trim();
const num = (f: FormData, n: string) => Number(f.get(n));
const go = (s: string): never =>
  redirect(`/dashboard/cash?status=${encodeURIComponent(s)}`);
async function run(path: string, body: unknown, status: string) {
  try {
    await requestOperationsFinanceEndpoint(path, "POST", body);
    revalidatePath("/dashboard/cash");
    go(status);
  } catch {
    go("conflict");
  }
}
export async function createCashRegisterAction(f: FormData) {
  await run(
    "cash-registers",
    {
      name: value(f, "name"),
      code: value(f, "code"),
      kind: "reception",
      currency: value(f, "currency"),
      difference_tolerance: num(f, "difference_tolerance"),
      active: true,
    },
    "created",
  );
}
export async function openCashSessionAction(f: FormData) {
  await run(
    `cash-registers/${value(f, "id")}/sessions`,
    {
      opening_float: num(f, "opening_float"),
      idempotency_key: crypto.randomUUID(),
    },
    "opened",
  );
}
export async function postCashMovementAction(f: FormData) {
  await run(
    `cash-sessions/${value(f, "id")}/movements`,
    {
      kind: value(f, "kind"),
      amount: num(f, "amount"),
      reason: value(f, "reason"),
      idempotency_key: crypto.randomUUID(),
    },
    "updated",
  );
}
export async function countCashSessionAction(f: FormData) {
  await run(
    `cash-sessions/${value(f, "id")}/actions`,
    {
      action: "count",
      expected_version: num(f, "version"),
      counted_amount: num(f, "counted_amount"),
      reason: value(f, "reason") || undefined,
      idempotency_key: crypto.randomUUID(),
    },
    "counted",
  );
}
export async function decideCashDifferenceAction(f: FormData) {
  await run(
    `cash-sessions/${value(f, "id")}/actions`,
    {
      action: value(f, "action"),
      expected_version: num(f, "version"),
      reason: value(f, "reason"),
      idempotency_key: crypto.randomUUID(),
    },
    "updated",
  );
}
export async function prepareDailyCloseAction(f: FormData) {
  await run(
    `daily-close/${value(f, "date")}/prepare`,
    { expected_version: num(f, "version"), accepted_pending: [] },
    "prepared",
  );
}
export async function approveDailyCloseAction(f: FormData) {
  await run(
    `daily-close/${value(f, "date")}/actions`,
    {
      action: value(f, "action"),
      expected_version: num(f, "version"),
      expected_fingerprint: value(f, "fingerprint"),
      reason: value(f, "reason") || "Conferência diária aprovada.",
    },
    "closed",
  );
}
