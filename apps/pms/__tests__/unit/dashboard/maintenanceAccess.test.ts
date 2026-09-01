import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@hotel/shared";
import { getMaintenanceAccess } from "../../../src/app/dashboard/maintenance/access";

describe("maintenance access", () => {
  it("não depende de nomes de papéis", () => {
    const access = getMaintenanceAccess({
      permissions: [PERMISSIONS.MAINTENANCE_EXECUTE],
    });
    expect(access.canEnter).toBe(true);
    expect(access.canExecute).toBe(true);
    expect(access.canTriage).toBe(false);
  });

  it("mantém inspeção, bloqueio e responsabilidade independentes", () => {
    const access = getMaintenanceAccess({
      permissions: [
        PERMISSIONS.MAINTENANCE_INSPECT,
        PERMISSIONS.MAINTENANCE_LIABILITY_CONFIRM,
      ],
    });
    expect(access.canInspect).toBe(true);
    expect(access.canConfirmLiability).toBe(true);
    expect(access.canManageBlocks).toBe(false);
  });

  it("mantém proposta, aprovação e liquidação financeira independentes", () => {
    const access = getMaintenanceAccess({
      permissions: [
        PERMISSIONS.MAINTENANCE_FINANCE_READ,
        PERMISSIONS.MAINTENANCE_FINANCE_APPROVE,
      ],
    });
    expect(access.canEnter).toBe(true);
    expect(access.canReadFinance).toBe(true);
    expect(access.canApproveFinance).toBe(true);
    expect(access.canProposeFinance).toBe(false);
    expect(access.canSettleFinance).toBe(false);
  });
});
