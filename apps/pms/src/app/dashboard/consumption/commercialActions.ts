"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PERMISSIONS,
  type AdminCommercialAgreementRevisionInput,
} from "@hotel/shared";
import {
  activateCommercialAgreementRevision,
  createCommercialAgreement,
  createCommercialAgreementRevision,
  createCommercialPartner,
  createCommercialPartnerContact,
  setCommercialPartnerArchived,
  setCommercialAgreementArchived,
  setCommercialPartnerContactArchived,
  terminateCommercialAgreementRevision,
  updateCommercialPartner,
} from "../../../lib/adminApi";
import { getUserFromSession } from "../../../lib/auth";

type Section = "partners" | "agreements";

function go(section: Section, status: string): never {
  redirect(
    `/dashboard/consumption/${section}?status=${encodeURIComponent(status)}&r=${Date.now().toString(36)}`,
  );
}

function refresh() {
  revalidatePath("/dashboard/consumption");
  revalidatePath("/dashboard/consumption/partners");
  revalidatePath("/dashboard/consumption/agreements");
  revalidatePath("/dashboard/consumption/offers");
  revalidatePath("/dashboard/products");
}

async function requirePermission(permission: string, section: Section) {
  const user = await getUserFromSession();
  if (!user?.permissions.includes(permission)) go(section, "forbidden");
}

export async function createCommercialPartnerAction(formData: FormData) {
  await requirePermission(PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE, "partners");
  const tradeName = String(formData.get("trade_name") || "").trim();
  const legalName = String(formData.get("legal_name") || "").trim();
  if (!tradeName || !legalName) go("partners", "invalid");
  try {
    await createCommercialPartner({
      trade_name: tradeName,
      legal_name: legalName,
      tax_id: String(formData.get("tax_id") || "").trim() || null,
      email: String(formData.get("email") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      is_active: true,
    });
  } catch {
    go("partners", "conflict");
  }
  refresh();
  go("partners", "created");
}

export async function updateCommercialPartnerAction(formData: FormData) {
  await requirePermission(PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE, "partners");
  const id = String(formData.get("id") || "").trim();
  const tradeName = String(formData.get("trade_name") || "").trim();
  const legalName = String(formData.get("legal_name") || "").trim();
  if (!id || !tradeName || !legalName) go("partners", "invalid");
  try {
    await updateCommercialPartner(id, {
      trade_name: tradeName,
      legal_name: legalName,
      tax_id: String(formData.get("tax_id") || "").trim() || null,
      email: String(formData.get("email") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      is_active: formData.get("is_active") === "on",
    });
  } catch {
    go("partners", "conflict");
  }
  refresh();
  go("partners", "updated");
}

export async function archiveCommercialPartnerAction(formData: FormData) {
  await requirePermission(PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE, "partners");
  const id = String(formData.get("id") || "").trim();
  if (!id) go("partners", "invalid");
  try {
    await setCommercialPartnerArchived(id, formData.get("archived") === "true");
  } catch {
    go("partners", "conflict");
  }
  refresh();
  go("partners", "updated");
}

export async function createCommercialPartnerContactAction(formData: FormData) {
  await requirePermission(PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE, "partners");
  const partnerId = String(formData.get("partner_id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  if (!partnerId || !name || (!email && !phone)) go("partners", "invalid");
  try {
    await createCommercialPartnerContact(partnerId, {
      name,
      role: String(formData.get("role") || "").trim() || null,
      purpose: String(formData.get("purpose") || "general") as
        "operational" | "financial" | "general",
      email: email || null,
      phone: phone || null,
      is_primary: formData.get("is_primary") === "on",
      is_active: true,
    });
  } catch {
    go("partners", "conflict");
  }
  refresh();
  go("partners", "contact-created");
}

export async function archiveCommercialPartnerContactAction(
  formData: FormData,
) {
  await requirePermission(PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE, "partners");
  const id = String(formData.get("id") || "").trim();
  if (!id) go("partners", "invalid");
  try {
    await setCommercialPartnerContactArchived(
      id,
      formData.get("archived") === "true",
    );
  } catch {
    go("partners", "conflict");
  }
  refresh();
  go("partners", "updated");
}

function revision(
  formData: FormData,
): AdminCommercialAgreementRevisionInput | null {
  const model = String(formData.get("commercial_model") || "");
  const points = formData.getAll("point_ids").map(String).filter(Boolean);
  const numberOrNull = (name: string) => {
    const raw = String(formData.get(name) || "").trim();
    return raw ? Number(raw) : null;
  };
  const result: AdminCommercialAgreementRevisionInput = {
    starts_on: String(formData.get("starts_on") || ""),
    ends_on: String(formData.get("ends_on") || "") || null,
    commercial_model:
      model as AdminCommercialAgreementRevisionInput["commercial_model"],
    fixed_rent: numberOrNull("fixed_rent"),
    rent_frequency: (String(formData.get("rent_frequency") || "") ||
      null) as AdminCommercialAgreementRevisionInput["rent_frequency"],
    commission_percentage: numberOrNull("commission_percentage"),
    minimum_guarantee: numberOrNull("minimum_guarantee"),
    payment_recipient: String(
      formData.get("payment_recipient") || "",
    ) as AdminCommercialAgreementRevisionInput["payment_recipient"],
    notes: String(formData.get("notes") || "").trim() || null,
    point_ids: points,
  };
  return result.starts_on &&
    points.length &&
    ["fixed_rent", "revenue_share", "hybrid"].includes(model)
    ? result
    : null;
}

export async function createCommercialAgreementAction(formData: FormData) {
  await requirePermission(
    PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
    "agreements",
  );
  const terms = revision(formData);
  const partnerId = String(formData.get("partner_id") || "").trim();
  const internalNumber = String(formData.get("internal_number") || "").trim();
  if (!terms || !partnerId || !internalNumber) go("agreements", "invalid");
  try {
    await createCommercialAgreement({
      partner_id: partnerId,
      internal_number: internalNumber,
      revision: terms,
    });
  } catch {
    go("agreements", "conflict");
  }
  refresh();
  go("agreements", "created");
}

export async function archiveCommercialAgreementAction(formData: FormData) {
  await requirePermission(
    PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
    "agreements",
  );
  const id = String(formData.get("id") || "").trim();
  if (!id) go("agreements", "invalid");
  try {
    await setCommercialAgreementArchived(
      id,
      formData.get("archived") === "true",
    );
  } catch {
    go("agreements", "conflict");
  }
  refresh();
  go("agreements", "updated");
}

export async function createCommercialAgreementRevisionAction(
  formData: FormData,
) {
  await requirePermission(
    PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
    "agreements",
  );
  const agreementId = String(formData.get("agreement_id") || "").trim();
  const terms = revision(formData);
  if (!agreementId || !terms) go("agreements", "invalid");
  try {
    await createCommercialAgreementRevision(agreementId, terms);
  } catch {
    go("agreements", "conflict");
  }
  refresh();
  go("agreements", "revision-created");
}

export async function activateCommercialAgreementRevisionAction(
  formData: FormData,
) {
  await requirePermission(
    PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
    "agreements",
  );
  const id = String(formData.get("revision_id") || "").trim();
  if (!id) go("agreements", "invalid");
  try {
    await activateCommercialAgreementRevision(id);
  } catch {
    go("agreements", "conflict");
  }
  refresh();
  go("agreements", "activated");
}

export async function terminateCommercialAgreementRevisionAction(
  formData: FormData,
) {
  await requirePermission(
    PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE,
    "agreements",
  );
  const id = String(formData.get("revision_id") || "").trim();
  const endsOn = String(formData.get("ends_on") || "");
  if (!id || !endsOn) go("agreements", "invalid");
  try {
    await terminateCommercialAgreementRevision(id, endsOn);
  } catch {
    go("agreements", "conflict");
  }
  refresh();
  go("agreements", "terminated");
}
