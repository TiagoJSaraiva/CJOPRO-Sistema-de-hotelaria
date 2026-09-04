import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_HOTEL_HEADER_NAME,
  PERMISSIONS,
  type AdminCommercialAgreement,
  type AdminCommercialPartner,
  type SessionPayload,
} from "@hotel/shared";
import { signToken } from "../../../src/auth/session";
import { registerCommercialPartnerRoutes } from "../../../src/routes/commercialPartnerRoutes";
import type { CommercialPartnersRepository } from "../../../src/repositories/commercialPartnersRepository";

const hotelId = "10000000-0000-4000-8000-000000000001";
const actorId = "80000000-0000-4000-8000-000000000002";
const partner: AdminCommercialPartner = {
  id: "b1000000-0000-4000-8000-000000000001",
  hotel_id: hotelId,
  trade_name: "Spa Azul",
  legal_name: "Spa Azul Ltda",
  tax_id: null,
  email: "contato@spa.example",
  phone: null,
  notes: null,
  is_active: true,
  archived_at: null,
  contacts: [],
};
const revision = {
  id: "b3000000-0000-4000-8000-000000000001",
  hotel_id: hotelId,
  agreement_id: "b2000000-0000-4000-8000-000000000001",
  version: 1,
  starts_on: "2026-09-01",
  ends_on: null,
  status: "draft" as const,
  effective_status: "draft" as const,
  commercial_model: "hybrid" as const,
  fixed_rent: 500,
  rent_frequency: "monthly" as const,
  commission_percentage: 8,
  minimum_guarantee: 900,
  payment_recipient: "both" as const,
  currency: "BRL",
  notes: null,
  point_ids: ["a1000000-0000-4000-8000-000000000001"],
  activated_at: null,
  terminated_at: null,
};
const agreement: AdminCommercialAgreement = {
  id: revision.agreement_id,
  hotel_id: hotelId,
  partner,
  internal_number: "AC-1",
  archived_at: null,
  revisions: [revision],
  current_revision: null,
};

function token(permissions: string[]) {
  const now = Math.floor(Date.now() / 1000);
  return signToken({
    id: actorId,
    name: "Gerente",
    email: "gerente@example.com",
    tenantId: null,
    roles: ["Gerente"],
    permissions,
    roleAssignments: [
      {
        roleId: "role-1",
        roleName: "Gerente",
        roleType: "HOTEL_ROLE",
        hotelId,
        hotelName: "Hotel",
      },
    ] as SessionPayload["roleAssignments"],
    iat: now,
    exp: now + 3600,
  });
}

function repository(): CommercialPartnersRepository {
  return {
    listPartners: vi.fn(async () => [partner]),
    getPartner: vi.fn(async () => partner),
    createPartner: vi.fn(async () => ({ result: "ok", item: partner })),
    updatePartner: vi.fn(async () => ({ result: "ok", item: partner })),
    createContact: vi.fn(async () => ({ result: "ok", item: undefined })),
    updateContact: vi.fn(async () => ({ result: "ok", item: undefined })),
    listAgreements: vi.fn(async () => [agreement]),
    getAgreement: vi.fn(async () => agreement),
    createAgreement: vi.fn(async () => ({ result: "ok", item: agreement })),
    setAgreementArchived: vi.fn(async () => ({
      result: "ok",
      item: { ...agreement, archived_at: "2026-09-04T12:00:00.000Z" },
    })),
    createRevision: vi.fn(async () => ({ result: "ok", item: revision })),
    updateRevision: vi.fn(async () => ({ result: "ok", item: revision })),
    setRevisionPoints: vi.fn(async () => ({ result: "ok", item: revision })),
    activateRevision: vi.fn(async () => ({ result: "ok", item: revision })),
    terminateRevision: vi.fn(async () => ({ result: "ok", item: revision })),
    listEligibility: vi.fn(async () => []),
    listHistory: vi.fn(async () => []),
  };
}

const apps: ReturnType<typeof Fastify>[] = [];
async function appWith(repo: CommercialPartnersRepository) {
  const app = Fastify();
  registerCommercialPartnerRoutes(app, repo);
  await app.ready();
  apps.push(app);
  return app;
}
const headers = (permissions: string[]) => ({
  authorization: `Bearer ${token(permissions)}`,
  [ACTIVE_HOTEL_HEADER_NAME]: hotelId,
});

afterEach(async () => {
  while (apps.length) await apps.pop()!.close();
});

describe("commercial partner routes", () => {
  it("requires authentication, permission and active hotel scope", async () => {
    const repo = repository();
    const app = await appWith(repo);
    expect(
      (await app.inject({ method: "GET", url: "/admin/commercial-partners" }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/admin/commercial-partners",
          headers: headers([]),
        })
      ).statusCode,
    ).toBe(403);
    expect(repo.listPartners).not.toHaveBeenCalled();
  });

  it("creates a scoped partner and contact", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const auth = headers([PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE]);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/admin/commercial-partners",
          headers: auth,
          payload: { trade_name: "Spa Azul", legal_name: "Spa Azul Ltda" },
        })
      ).statusCode,
    ).toBe(201);
    expect(repo.createPartner).toHaveBeenCalledWith(
      hotelId,
      actorId,
      expect.objectContaining({ trade_name: "Spa Azul" }),
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/admin/commercial-partners/${partner.id}/contacts`,
          headers: auth,
          payload: {
            name: "Ana",
            purpose: "financial",
            email: "ana@spa.example",
          },
        })
      ).statusCode,
    ).toBe(201);
  });

  it("validates commercial shapes before persistence and exposes overlap", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const auth = headers([PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE]);
    const invalid = await app.inject({
      method: "POST",
      url: "/admin/commercial-agreements",
      headers: auth,
      payload: {
        partner_id: partner.id,
        internal_number: "AC-1",
        revision: {
          starts_on: "2026-09-01",
          commercial_model: "fixed_rent",
          commission_percentage: 10,
          payment_recipient: "hotel",
          point_ids: revision.point_ids,
        },
      },
    });
    expect(invalid.statusCode).toBe(400);
    expect(repo.createAgreement).not.toHaveBeenCalled();
    vi.mocked(repo.activateRevision).mockResolvedValueOnce({
      result: "overlap",
    });
    const overlap = await app.inject({
      method: "POST",
      url: `/admin/commercial-agreement-revisions/${revision.id}/activate`,
      headers: auth,
    });
    expect(overlap.statusCode).toBe(409);
  });

  it("archives an agreement only with agreement management permission", async () => {
    const repo = repository();
    const app = await appWith(repo);
    const denied = await app.inject({
      method: "POST",
      url: `/admin/commercial-agreements/${agreement.id}/archive`,
      headers: headers([PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE]),
    });
    expect(denied.statusCode).toBe(403);

    const response = await app.inject({
      method: "POST",
      url: `/admin/commercial-agreements/${agreement.id}/archive`,
      headers: headers([PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE]),
    });
    expect(response.statusCode).toBe(200);
    expect(repo.setAgreementArchived).toHaveBeenCalledWith(
      agreement.id,
      hotelId,
      actorId,
      true,
    );
  });
});
