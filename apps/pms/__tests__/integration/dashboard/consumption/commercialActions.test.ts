import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  revalidatePath: vi.fn(),
  getUser: vi.fn(),
  createPartner: vi.fn(),
  createContact: vi.fn(),
  createAgreement: vi.fn(),
  activateRevision: vi.fn(),
  archiveAgreement: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: mocks.getUser,
}));
vi.mock("../../../../src/lib/adminApi", () => ({
  createCommercialPartner: mocks.createPartner,
  createCommercialPartnerContact: mocks.createContact,
  createCommercialAgreement: mocks.createAgreement,
  activateCommercialAgreementRevision: mocks.activateRevision,
  createCommercialAgreementRevision: vi.fn(),
  setCommercialPartnerArchived: vi.fn(),
  setCommercialAgreementArchived: mocks.archiveAgreement,
  setCommercialPartnerContactArchived: vi.fn(),
  terminateCommercialAgreementRevision: vi.fn(),
  updateCommercialPartner: vi.fn(),
}));

import {
  activateCommercialAgreementRevisionAction,
  archiveCommercialAgreementAction,
  createCommercialAgreementAction,
  createCommercialPartnerAction,
} from "../../../../src/app/dashboard/consumption/commercialActions";

describe("dashboard/consumption commercial actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a partner with dedicated permission", async () => {
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.COMMERCIAL_PARTNERS_MANAGE],
    });
    const form = new FormData();
    form.set("trade_name", "Spa Azul");
    form.set("legal_name", "Spa Azul Ltda");
    form.set("email", "contato@spa.example");
    await expect(createCommercialPartnerAction(form)).rejects.toThrow(
      /^REDIRECT:\/dashboard\/consumption\/partners\?status=created/,
    );
    expect(mocks.createPartner).toHaveBeenCalledWith(
      expect.objectContaining({ trade_name: "Spa Azul", is_active: true }),
    );
  });

  it("creates a complete hybrid draft", async () => {
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE],
    });
    const form = new FormData();
    form.set("partner_id", "partner-1");
    form.set("internal_number", "AC-1");
    form.set("starts_on", "2026-09-01");
    form.set("commercial_model", "hybrid");
    form.set("fixed_rent", "500");
    form.set("rent_frequency", "monthly");
    form.set("commission_percentage", "8");
    form.set("minimum_guarantee", "900");
    form.set("payment_recipient", "both");
    form.append("point_ids", "point-1");
    await expect(createCommercialAgreementAction(form)).rejects.toThrow(
      /^REDIRECT:\/dashboard\/consumption\/agreements\?status=created/,
    );
    expect(mocks.createAgreement).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: expect.objectContaining({
          commercial_model: "hybrid",
          fixed_rent: 500,
          commission_percentage: 8,
          point_ids: ["point-1"],
        }),
      }),
    );
  });

  it("blocks activation without agreement permission", async () => {
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.COMMERCIAL_PARTNERS_READ],
    });
    const form = new FormData();
    form.set("revision_id", "revision-1");
    await expect(
      activateCommercialAgreementRevisionAction(form),
    ).rejects.toThrow(
      /^REDIRECT:\/dashboard\/consumption\/agreements\?status=forbidden/,
    );
    expect(mocks.activateRevision).not.toHaveBeenCalled();
  });

  it("archives an agreement with dedicated agreement permission", async () => {
    mocks.getUser.mockResolvedValue({
      permissions: [PERMISSIONS.COMMERCIAL_AGREEMENTS_MANAGE],
    });
    const form = new FormData();
    form.set("id", "agreement-1");
    form.set("archived", "true");
    await expect(archiveCommercialAgreementAction(form)).rejects.toThrow(
      /^REDIRECT:\/dashboard\/consumption\/agreements\?status=updated/,
    );
    expect(mocks.archiveAgreement).toHaveBeenCalledWith("agreement-1", true);
  });
});
