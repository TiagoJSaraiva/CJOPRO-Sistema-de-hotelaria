"use server";

import { revalidatePath } from "next/cache";
import {
  actPostCheckoutConsumptionCase,
  addPostCheckoutConsumptionEvidence,
  createPostCheckoutConsumptionCase,
  payPostCheckoutConsumptionCase,
} from "../../../../lib/adminApi";

const path = "/dashboard/consumption/post-checkout";

export async function createPostCheckoutCaseAction(formData: FormData) {
  await createPostCheckoutConsumptionCase({
    stay_id: String(formData.get("stay_id")),
    occurred_at: new Date(String(formData.get("occurred_at"))).toISOString(),
    report: String(formData.get("report")),
    items: [
      {
        offer_id: String(formData.get("offer_id")),
        quantity: Number(formData.get("quantity")),
      },
    ],
  });
  revalidatePath(path);
}

export async function actPostCheckoutCaseAction(formData: FormData) {
  await actPostCheckoutConsumptionCase(String(formData.get("id")), {
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
  });
  revalidatePath(path);
}

export async function addPostCheckoutEvidenceAction(formData: FormData) {
  await addPostCheckoutConsumptionEvidence(String(formData.get("id")), {
    private_path: String(formData.get("private_path")),
    description: String(formData.get("description")),
  });
  revalidatePath(path);
}

export async function payPostCheckoutCaseAction(formData: FormData) {
  await payPostCheckoutConsumptionCase(String(formData.get("id")), {
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
  });
  revalidatePath(path);
}
