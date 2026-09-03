import { describe, expect, it } from "vitest";
import { validateUsageGuideDefinition } from "../../../src/app/dashboard/_components/UsageGuide";
import {
  advancedMaintenanceGuides,
  financialMaintenanceGuides,
  getMaintenanceOccurrenceGuide,
  operationalMaintenanceGuides,
} from "../../../src/app/dashboard/maintenance/usageGuides";

describe("guias operacionais de manutenção", () => {
  it("mantém identificadores, alvos e conteúdo válidos", () => {
    for (const guide of operationalMaintenanceGuides) {
      expect(validateUsageGuideDefinition(guide), guide.id).toEqual([]);
    }
  });

  it("mantém válidos os guias financeiros e suas variações autorizadas", () => {
    for (const guide of financialMaintenanceGuides) {
      expect(validateUsageGuideDefinition(guide), guide.id).toEqual([]);
    }
    expect(
      getMaintenanceOccurrenceGuide(false).steps.some(
        (step) => step.id === "finance",
      ),
    ).toBe(false);
    expect(
      getMaintenanceOccurrenceGuide(true).steps.some(
        (step) => step.id === "finance",
      ),
    ).toBe(true);
  });

  it("mantém válidos os guias das páginas avançadas", () => {
    for (const guide of advancedMaintenanceGuides) {
      expect(validateUsageGuideDefinition(guide), guide.id).toEqual([]);
    }
  });
});
