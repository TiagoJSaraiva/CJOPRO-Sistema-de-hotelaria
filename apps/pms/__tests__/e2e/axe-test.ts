import AxeBuilder from "@axe-core/playwright";
import { expect, test as base } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type AccessibilityFixtures = {
  auditAccessibility: (stateName: string) => Promise<void>;
};

function formatViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(" ")).join(", ");
      return `${violation.id}: ${violation.help} (${targets})`;
    })
    .join("\n");
}

export const test = base.extend<AccessibilityFixtures>({
  auditAccessibility: async ({ page }, fixtureUse, testInfo) => {
    await fixtureUse(async (stateName) => {
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      const attachmentName = `axe-${stateName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const attachmentPath = testInfo.outputPath(`${attachmentName}.json`);

      await writeFile(attachmentPath, JSON.stringify(results, null, 2), "utf8");

      await testInfo.attach(`${attachmentName}.json`, {
        path: attachmentPath,
        contentType: "application/json"
      });

      expect(results.violations, formatViolations(results.violations)).toEqual([]);
    });
  }
});

export { expect };
