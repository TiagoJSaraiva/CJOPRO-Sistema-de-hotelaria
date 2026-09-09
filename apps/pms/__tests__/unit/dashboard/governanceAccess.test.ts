import { expect, it } from "vitest";
import { PERMISSIONS } from "@hotel/shared";
import { getGovernanceAccess } from "../../../src/app/dashboard/governance/access";

it("mantém execução, inspeção, templates e finanças independentes", () => {
  const access = getGovernanceAccess({
    permissions: [PERMISSIONS.GOVERNANCE_READ, PERMISSIONS.GOVERNANCE_INSPECT],
  });
  expect(access).toMatchObject({
    canRead: true,
    canExecute: false,
    canInspect: true,
    canManageTemplates: false,
    canPostConsumption: false,
  });
});
