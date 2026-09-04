import type {
  AdminCommercialAgreement,
  AdminCommercialAgreementCreateInput,
  AdminCommercialAgreementEligibility,
  AdminCommercialAgreementRevision,
  AdminCommercialAgreementRevisionInput,
  AdminCommercialAuditEvent,
  AdminCommercialPartner,
  AdminCommercialPartnerContact,
  AdminCommercialPartnerContactInput,
  AdminCommercialPartnerInput,
  TablesUpdate,
} from "@hotel/shared";
import { applyHotelContextFilter } from "../common/hotelContextFilter";
import { createServerClient } from "../common/supabaseServer";
import {
  isSupabaseConflictError,
  isSupabaseNotFoundError,
} from "./supabaseError";

const CONTACT_FIELDS =
  "id,hotel_id,partner_id,name,role,purpose,email,phone,is_primary,is_active,archived_at,created_at,updated_at";
const PARTNER_SUMMARY_FIELDS = "id,trade_name,is_active,archived_at";
const PARTNER_FIELDS = `id,hotel_id,trade_name,legal_name,tax_id,email,phone,notes,is_active,archived_at,created_at,updated_at,contacts:commercial_partner_contacts(${CONTACT_FIELDS})`;
const REVISION_FIELDS =
  "id,hotel_id,agreement_id,version,starts_on,ends_on,status,commercial_model,fixed_rent,rent_frequency,commission_percentage,minimum_guarantee,payment_recipient,currency,notes,activated_at,terminated_at,created_at,updated_at,points:commercial_agreement_revision_points(point_id)";
const AGREEMENT_FIELDS = `id,hotel_id,internal_number,archived_at,created_at,updated_at,partner:commercial_partners(${PARTNER_SUMMARY_FIELDS}),revisions:commercial_agreement_revisions(${REVISION_FIELDS})`;

export type CommercialWriteResult = "ok" | "conflict" | "not-found" | "overlap";
type PartnerRow = Omit<AdminCommercialPartner, "contacts"> & {
  contacts:
    AdminCommercialPartnerContact[] | AdminCommercialPartnerContact | null;
};
type RevisionRow = Omit<
  AdminCommercialAgreementRevision,
  "point_ids" | "effective_status"
> & { points: Array<{ point_id: string }> | { point_id: string } | null };
type AgreementRow = Omit<
  AdminCommercialAgreement,
  "partner" | "revisions" | "current_revision"
> & {
  partner:
    AdminCommercialAgreement["partner"] | AdminCommercialAgreement["partner"][];
  revisions: RevisionRow[] | RevisionRow | null;
};
type AuditRow = Omit<AdminCommercialAuditEvent, "actor_name"> & {
  users: { name: string } | { name: string }[] | null;
};

function effectiveStatus(
  revision: Omit<
    AdminCommercialAgreementRevision,
    "effective_status" | "point_ids"
  >,
  revisions: Array<
    Omit<AdminCommercialAgreementRevision, "effective_status" | "point_ids">
  >,
): AdminCommercialAgreementRevision["effective_status"] {
  if (revision.status === "draft") return "draft";
  if (revision.status === "terminated") return "terminated";
  const today = new Date().toISOString().slice(0, 10);
  if (revision.starts_on > today) return "scheduled";
  if (
    revisions.some(
      (candidate) =>
        candidate.status === "activated" &&
        candidate.version > revision.version &&
        candidate.starts_on <= today,
    )
  )
    return "superseded";
  if (revision.ends_on && revision.ends_on < today) return "expired";
  return "current";
}

function mapRevision(
  row: RevisionRow,
  allRows: RevisionRow[],
): AdminCommercialAgreementRevision {
  const { points, ...revision } = row;
  const pointRows = Array.isArray(points) ? points : points ? [points] : [];
  return {
    ...revision,
    point_ids: pointRows.map((point) => point.point_id),
    effective_status: effectiveStatus(revision, allRows),
  };
}

function mapAgreement(row: AgreementRow): AdminCommercialAgreement {
  const partner = Array.isArray(row.partner) ? row.partner[0] : row.partner;
  if (!partner) throw new Error("Acordo sem parceiro associado.");
  const revisionRows = Array.isArray(row.revisions)
    ? row.revisions
    : row.revisions
      ? [row.revisions]
      : [];
  const revisions = revisionRows
    .map((revision) => mapRevision(revision, revisionRows))
    .sort((a, b) => b.version - a.version);
  return {
    ...row,
    partner,
    revisions,
    current_revision:
      revisions.find((revision) => revision.effective_status === "current") ||
      null,
  };
}

function mapPartner(row: PartnerRow): AdminCommercialPartner {
  const contacts = Array.isArray(row.contacts)
    ? row.contacts
    : row.contacts
      ? [row.contacts]
      : [];
  return { ...row, contacts };
}

function revisionRpc(input: AdminCommercialAgreementRevisionInput) {
  const rpcNullable = <T>(value: T | null | undefined): T =>
    (value ?? null) as T;
  return {
    p_starts_on: input.starts_on,
    p_ends_on: rpcNullable<string>(input.ends_on),
    p_commercial_model: input.commercial_model,
    p_fixed_rent: rpcNullable<number>(input.fixed_rent),
    p_rent_frequency: rpcNullable<NonNullable<typeof input.rent_frequency>>(
      input.rent_frequency,
    ),
    p_commission_percentage: rpcNullable<number>(input.commission_percentage),
    p_minimum_guarantee: rpcNullable<number>(input.minimum_guarantee),
    p_payment_recipient: input.payment_recipient,
    p_notes: rpcNullable<string>(input.notes),
    p_point_ids: input.point_ids,
  };
}

export interface CommercialPartnersRepository {
  listPartners(
    hotelId: string,
    includeArchived?: boolean,
  ): Promise<AdminCommercialPartner[]>;
  getPartner(
    id: string,
    hotelId: string,
  ): Promise<AdminCommercialPartner | null>;
  createPartner(
    hotelId: string,
    actorId: string,
    input: AdminCommercialPartnerInput,
  ): Promise<{ result: CommercialWriteResult; item?: AdminCommercialPartner }>;
  updatePartner(
    id: string,
    hotelId: string,
    actorId: string,
    input: Partial<AdminCommercialPartnerInput> & {
      archived_at?: string | null;
    },
  ): Promise<{ result: CommercialWriteResult; item?: AdminCommercialPartner }>;
  createContact(
    partnerId: string,
    hotelId: string,
    actorId: string,
    input: AdminCommercialPartnerContactInput,
  ): Promise<{
    result: CommercialWriteResult;
    item?: AdminCommercialPartnerContact;
  }>;
  updateContact(
    id: string,
    hotelId: string,
    actorId: string,
    input: Partial<AdminCommercialPartnerContactInput> & {
      archived_at?: string | null;
    },
  ): Promise<{
    result: CommercialWriteResult;
    item?: AdminCommercialPartnerContact;
  }>;
  listAgreements(
    hotelId: string,
    includeArchived?: boolean,
  ): Promise<AdminCommercialAgreement[]>;
  getAgreement(
    id: string,
    hotelId: string,
  ): Promise<AdminCommercialAgreement | null>;
  createAgreement(
    hotelId: string,
    actorId: string,
    input: AdminCommercialAgreementCreateInput,
  ): Promise<{
    result: CommercialWriteResult;
    item?: AdminCommercialAgreement;
  }>;
  setAgreementArchived(
    id: string,
    hotelId: string,
    actorId: string,
    archived: boolean,
  ): Promise<{
    result: CommercialWriteResult;
    item?: AdminCommercialAgreement;
  }>;
  createRevision(
    agreementId: string,
    hotelId: string,
    actorId: string,
    input: AdminCommercialAgreementRevisionInput,
  ): Promise<{
    result: CommercialWriteResult;
    item?: AdminCommercialAgreementRevision;
  }>;
  updateRevision(
    id: string,
    hotelId: string,
    actorId: string,
    input: Partial<AdminCommercialAgreementRevisionInput>,
  ): Promise<{
    result: CommercialWriteResult;
    item?: AdminCommercialAgreementRevision;
  }>;
  setRevisionPoints(
    id: string,
    hotelId: string,
    actorId: string,
    pointIds: string[],
  ): Promise<{
    result: CommercialWriteResult;
    item?: AdminCommercialAgreementRevision;
  }>;
  activateRevision(
    id: string,
    hotelId: string,
    actorId: string,
  ): Promise<{
    result: CommercialWriteResult;
    item?: AdminCommercialAgreementRevision;
  }>;
  terminateRevision(
    id: string,
    hotelId: string,
    actorId: string,
    endsOn: string,
  ): Promise<{
    result: CommercialWriteResult;
    item?: AdminCommercialAgreementRevision;
  }>;
  listEligibility(
    hotelId: string,
    productId: string,
    pointId: string,
  ): Promise<AdminCommercialAgreementEligibility[]>;
  listHistory(
    hotelId: string,
    entityId: string,
    agreement?: boolean,
  ): Promise<AdminCommercialAuditEvent[]>;
}

class SupabaseCommercialPartnersRepository implements CommercialPartnersRepository {
  async listPartners(hotelId: string, includeArchived = false) {
    let query = createServerClient()
      .from("commercial_partners")
      .select(PARTNER_FIELDS);
    query = applyHotelContextFilter(query, hotelId);
    if (!includeArchived) query = query.is("archived_at", null);
    const { data, error } = await query.order("trade_name");
    if (error) throw error;
    return ((data || []) as unknown as PartnerRow[]).map(mapPartner);
  }

  async getPartner(id: string, hotelId: string) {
    let query = createServerClient()
      .from("commercial_partners")
      .select(PARTNER_FIELDS)
      .eq("id", id);
    query = applyHotelContextFilter(query, hotelId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? mapPartner(data as unknown as PartnerRow) : null;
  }

  async createPartner(
    hotelId: string,
    actorId: string,
    input: AdminCommercialPartnerInput,
  ) {
    const { data, error } = await createServerClient()
      .from("commercial_partners")
      .insert({ ...input, hotel_id: hotelId, last_changed_by: actorId })
      .select("id")
      .single();
    if (error) {
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: (await this.getPartner(data.id, hotelId))!,
    };
  }

  async updatePartner(
    id: string,
    hotelId: string,
    actorId: string,
    input: Partial<AdminCommercialPartnerInput> & {
      archived_at?: string | null;
    },
  ) {
    let query = createServerClient()
      .from("commercial_partners")
      .update({ ...input, last_changed_by: actorId })
      .eq("id", id);
    query = applyHotelContextFilter(query, hotelId);
    const { error } = await query.select("id").single();
    if (error) {
      if (isSupabaseNotFoundError(error))
        return { result: "not-found" as const };
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: (await this.getPartner(id, hotelId))!,
    };
  }

  async createContact(
    partnerId: string,
    hotelId: string,
    actorId: string,
    input: AdminCommercialPartnerContactInput,
  ) {
    const { data, error } = await createServerClient()
      .from("commercial_partner_contacts")
      .insert({
        ...input,
        partner_id: partnerId,
        hotel_id: hotelId,
        last_changed_by: actorId,
      })
      .select(CONTACT_FIELDS)
      .single();
    if (error) {
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: data as unknown as AdminCommercialPartnerContact,
    };
  }

  async updateContact(
    id: string,
    hotelId: string,
    actorId: string,
    input: Partial<AdminCommercialPartnerContactInput> & {
      archived_at?: string | null;
    },
  ) {
    let query = createServerClient()
      .from("commercial_partner_contacts")
      .update({ ...input, last_changed_by: actorId })
      .eq("id", id);
    query = applyHotelContextFilter(query, hotelId);
    const { data, error } = await query.select(CONTACT_FIELDS).single();
    if (error) {
      if (isSupabaseNotFoundError(error))
        return { result: "not-found" as const };
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: data as unknown as AdminCommercialPartnerContact,
    };
  }

  async listAgreements(hotelId: string, includeArchived = false) {
    let query = createServerClient()
      .from("commercial_agreements")
      .select(AGREEMENT_FIELDS);
    query = applyHotelContextFilter(query, hotelId);
    if (!includeArchived) query = query.is("archived_at", null);
    const { data, error } = await query.order("internal_number");
    if (error) throw error;
    return ((data || []) as unknown as AgreementRow[]).map(mapAgreement);
  }

  async getAgreement(id: string, hotelId: string) {
    let query = createServerClient()
      .from("commercial_agreements")
      .select(AGREEMENT_FIELDS)
      .eq("id", id);
    query = applyHotelContextFilter(query, hotelId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? mapAgreement(data as unknown as AgreementRow) : null;
  }

  async getRevision(id: string, hotelId: string) {
    let query = createServerClient()
      .from("commercial_agreement_revisions")
      .select(REVISION_FIELDS)
      .eq("id", id);
    query = applyHotelContextFilter(query, hotelId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data
      ? mapRevision(data as unknown as RevisionRow, [
          data as unknown as RevisionRow,
        ])
      : null;
  }

  async createAgreement(
    hotelId: string,
    actorId: string,
    input: AdminCommercialAgreementCreateInput,
  ) {
    const { data, error } = await createServerClient().rpc(
      "create_commercial_agreement",
      {
        p_hotel_id: hotelId,
        p_partner_id: input.partner_id,
        p_internal_number: input.internal_number,
        p_actor_id: actorId,
        ...revisionRpc(input.revision),
      },
    );
    if (error) {
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: (await this.getAgreement(data, hotelId))!,
    };
  }

  async createRevision(
    agreementId: string,
    hotelId: string,
    actorId: string,
    input: AdminCommercialAgreementRevisionInput,
  ) {
    const { data, error } = await createServerClient().rpc(
      "create_commercial_agreement_revision",
      {
        p_hotel_id: hotelId,
        p_agreement_id: agreementId,
        p_actor_id: actorId,
        ...revisionRpc(input),
      },
    );
    if (error) {
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: (await this.getRevision(data, hotelId))!,
    };
  }

  async setAgreementArchived(
    id: string,
    hotelId: string,
    actorId: string,
    archived: boolean,
  ) {
    let query = createServerClient()
      .from("commercial_agreements")
      .update({
        archived_at: archived ? new Date().toISOString() : null,
        last_changed_by: actorId,
      })
      .eq("id", id);
    query = applyHotelContextFilter(query, hotelId);
    const { error } = await query.select("id").single();
    if (error) {
      if (isSupabaseNotFoundError(error))
        return { result: "not-found" as const };
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: (await this.getAgreement(id, hotelId))!,
    };
  }

  async updateRevision(
    id: string,
    hotelId: string,
    actorId: string,
    input: Partial<AdminCommercialAgreementRevisionInput>,
  ) {
    const terms = { ...input };
    delete terms.point_ids;
    let query = createServerClient()
      .from("commercial_agreement_revisions")
      .update({
        ...(terms as TablesUpdate<"commercial_agreement_revisions">),
        last_changed_by: actorId,
      })
      .eq("id", id)
      .eq("status", "draft");
    query = applyHotelContextFilter(query, hotelId);
    const { error } = await query.select("id").single();
    if (error) {
      if (isSupabaseNotFoundError(error))
        return { result: "not-found" as const };
      if (isSupabaseConflictError(error))
        return { result: "conflict" as const };
      throw error;
    }
    return {
      result: "ok" as const,
      item: (await this.getRevision(id, hotelId))!,
    };
  }

  async setRevisionPoints(
    id: string,
    hotelId: string,
    actorId: string,
    pointIds: string[],
  ) {
    const { data, error } = await createServerClient().rpc(
      "set_commercial_agreement_revision_points",
      {
        p_hotel_id: hotelId,
        p_revision_id: id,
        p_actor_id: actorId,
        p_point_ids: pointIds,
      },
    );
    if (error) throw error;
    if (data !== "ok") return { result: "conflict" as const };
    return {
      result: "ok" as const,
      item: (await this.getRevision(id, hotelId))!,
    };
  }

  async activateRevision(id: string, hotelId: string, actorId: string) {
    const { data, error } = await createServerClient().rpc(
      "activate_commercial_agreement_revision",
      { p_hotel_id: hotelId, p_revision_id: id, p_actor_id: actorId },
    );
    if (error) throw error;
    if (data !== "ok")
      return {
        result:
          data === "overlap" ? ("overlap" as const) : ("conflict" as const),
      };
    return {
      result: "ok" as const,
      item: (await this.getRevision(id, hotelId))!,
    };
  }

  async terminateRevision(
    id: string,
    hotelId: string,
    actorId: string,
    endsOn: string,
  ) {
    const { data, error } = await createServerClient().rpc(
      "terminate_commercial_agreement_revision",
      {
        p_hotel_id: hotelId,
        p_revision_id: id,
        p_actor_id: actorId,
        p_ends_on: endsOn,
      },
    );
    if (error) throw error;
    if (data !== "ok") return { result: "conflict" as const };
    return {
      result: "ok" as const,
      item: (await this.getRevision(id, hotelId))!,
    };
  }

  async listEligibility(hotelId: string, productId: string, pointId: string) {
    const supabase = createServerClient();
    const { data: product, error } = await supabase
      .from("products")
      .select("commercial_partner_id,provider_type")
      .eq("id", productId)
      .eq("hotel_id", hotelId)
      .maybeSingle();
    if (error) throw error;
    if (
      !product ||
      product.provider_type !== "partner" ||
      !product.commercial_partner_id
    )
      return [];
    const agreements = (await this.listAgreements(hotelId, false)).filter(
      (agreement) => agreement.partner.id === product.commercial_partner_id,
    );
    return agreements.map((agreement) => {
      const revision =
        agreement.revisions.find((candidate) =>
          candidate.point_ids.includes(pointId),
        ) || null;
      const eligible = Boolean(
        revision &&
        ["draft", "scheduled", "current"].includes(revision.effective_status),
      );
      return {
        agreement_id: agreement.id,
        internal_number: agreement.internal_number,
        eligible,
        reason: eligible ? null : "Acordo sem revisão aplicável ao ponto.",
        revision,
      };
    });
  }

  async listHistory(hotelId: string, entityId: string, agreement = false) {
    let entityIds = [entityId];
    if (agreement) {
      const item = await this.getAgreement(entityId, hotelId);
      entityIds = [
        entityId,
        ...(item?.revisions.map((revision) => revision.id) || []),
      ];
    }
    let query = createServerClient()
      .from("commercial_audit_events")
      .select(
        "id,hotel_id,entity_type,entity_id,actor_id,action,changes,created_at,users:actor_id(name)",
      )
      .in("entity_id", entityIds);
    query = applyHotelContextFilter(query, hotelId);
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) throw error;
    return ((data || []) as unknown as AuditRow[]).map(
      ({ users, ...event }) => ({
        ...event,
        actor_name: (Array.isArray(users) ? users[0] : users)?.name || null,
      }),
    );
  }
}

export function createCommercialPartnersRepository(): CommercialPartnersRepository {
  return new SupabaseCommercialPartnersRepository();
}
