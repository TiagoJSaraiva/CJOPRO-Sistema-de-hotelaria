import { describe, expect, it } from "vitest";
import { validateUsageGuideDefinition } from "../../../src/app/dashboard/_components/UsageGuide";
import { operationalMaintenanceGuides } from "../../../src/app/dashboard/maintenance/usageGuides";

describe("guias operacionais de manutenção", () => {
  it("mantém identificadores, alvos e conteúdo válidos", () => {
    for (const guide of operationalMaintenanceGuides) {
      expect(validateUsageGuideDefinition(guide), guide.id).toEqual([]);
    }
  });
});
