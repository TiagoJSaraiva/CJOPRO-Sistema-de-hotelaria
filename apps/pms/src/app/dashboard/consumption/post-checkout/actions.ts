"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  actPostCheckoutConsumptionCase,
  addPostCheckoutConsumptionEvidence,
  createPostCheckoutConsumptionCase,
  payPostCheckoutConsumptionCase,
} from "../../../../lib/adminApi";
import { readHotelInstant } from "../../../../lib/hotelClock";
import { failureStatus } from "../../_components/operationOutcome";

const path = "/dashboard/consumption/post-checkout";

async function run(request: () => Promise<unknown>) {
  try {
    await request();
  } catch (error) {
    redirect(`${path}?status=${failureStatus(error)}`);
  }
  revalidatePath(path);
}

export async function createPostCheckoutCaseAction(formData: FormData) {
  const occurredAt = await readHotelInstant(formData.get("occurred_at"));
  await run(() =>
    createPostCheckoutConsumptionCase({
      stay_id: String(formData.get("stay_id")),
      occurred_at: occurredAt,
      report: String(formData.get("report")),
      items: [
        {
          offer_id: String(formData.get("offer_id")),
          quantity: Number(formData.get("quantity")),
        },
      ],
    }),
  );
}

export async function actPostCheckoutCaseAction(formData: FormData) {
  await run(() =>
    actPostCheckoutConsumptionCase(String(formData.get("id")), {
      action: String(formData.get("action")) as
        | "submit"
        | "approve"
        | "reject"
        | "record_contact"
        | "dispute"
        | "resume_collection"
        | "waive"
        | "cancel",
      expected_version: Number(formData.get("version")),
      reason: String(formData.get("reason")),
      result: String(formData.get("result") || "") || undefined,
      promised_at: String(formData.get("promised_at") || "") || undefined,
    }),
  );
}

export async function addPostCheckoutEvidenceAction(formData: FormData) {
  await run(() =>
    addPostCheckoutConsumptionEvidence(String(formData.get("id")), {
      private_path: String(formData.get("private_path")),
      description: String(formData.get("description")),
    }),
  );
}

export async function payPostCheckoutCaseAction(formData: FormData) {
  await run(() =>
    payPostCheckoutConsumptionCase(String(formData.get("id")), {
      expected_version: Number(formData.get("version")),
      idempotency_key: crypto.randomUUID(),
      tenders: [
        {
          payment_method: String(formData.get("payment_method")),
          amount: Number(formData.get("amount")),
          reference_code:
            String(formData.get("reference_code") || "") || undefined,
        },
      ],
    }),
  );
}
