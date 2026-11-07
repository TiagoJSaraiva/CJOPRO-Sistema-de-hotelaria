import type { Page } from "@playwright/test";
import {
  expect,
  findInvariantViolations,
  prepareScenario,
  queryLocal,
  signIn,
  signOut,
  test,
} from "./support";

// Fonte das expectativas: docs/training/lesson-05-warranty.md. O alerta de garantia não significa
// defeito e não cria ocorrência; ele se encerra com uma decisão auditável.
const AURORA_ID = "10000000-0000-4000-8000-000000000001";
const LOCATION_ID = "99500000-0000-4000-8000-000000000001";
const OTHER_HOTEL_LOCATION = "96000000-0000-4000-8000-000000000002";
const SUPERVISOR = "supervisor.manutencao.aurora@hotelaria.local";
const MANAGER = "gerente.aurora@hotelaria.local";
const SETTINGS = `/dashboard/maintenance/settings?location=${LOCATION_ID}`;

function locationVersion(): number {
  return Number(
    queryLocal(
      `select version from public.maintenance_locations where id = '${LOCATION_ID}';`,
    ),
  );
}

function decisionCount(): string {
  return queryLocal(`
    select count(*) from public.maintenance_warranty_decisions
    where location_id = '${LOCATION_ID}';
  `);
}

function openWarrantyPending(): string {
  return queryLocal(`
    select count(*) from public.operational_pending
    where hotel_id = '${AURORA_ID}' and kind = 'warranty_expiry' and status <> 'resolved';
  `);
}

async function refreshPending(page: Page) {
  await page.goto("/dashboard/pending");
  await page.getByRole("button", { name: "Atualizar pendências" }).click();
  await expect(
    page.getByRole("button", { name: "Atualizar pendências" }),
  ).toBeEnabled();
}

async function decide(page: Page, data: Record<string, unknown>) {
  return page.request.post(
    `/api/maintenance/locations/${LOCATION_ID}/warranty-decisions`,
    {
      data: {
        expected_location_version: locationVersion(),
        reason: "Exercício da lição de garantia",
        ...data,
      },
    },
  );
}

test("lição 5: área, equipamento e decisão de garantia", async ({
  page,
  diagnostics,
}) => {
  await prepareScenario("warranty");
  diagnostics.allow(/warranty-decisions/);
  diagnostics.allow(/status of (400|403|404|409)/);
  const expiry = queryLocal(`
    select warranty_ends_on from public.maintenance_locations where id = '${LOCATION_ID}';
  `);

  await test.step("Estado inicial: vence em sete dias, sem decisão e sem ocorrência", async () => {
    expect
      .soft(
        queryLocal(
          `select public.hotel_operational_date('${AURORA_ID}') + 7 = '${expiry}'::date;`,
        ),
      )
      .toBe("t");
    expect.soft(decisionCount()).toBe("0");
    const occurrences = queryLocal(`
      select count(*) from public.maintenance_occurrences
      where location_id = '${LOCATION_ID}';
    `);
    expect.soft(occurrences, "o alerta não cria ocorrência").toBe("0");
  });

  await test.step("1. O alerta destaca o equipamento correto", async () => {
    await signIn(page, SUPERVISOR);
    await refreshPending(page);
    await expect.poll(openWarrantyPending).toBe("1");
    await page.reload();
    await page
      .getByRole("heading", { name: "Garantia de equipamento" })
      .locator(
        'xpath=ancestor::*[.//button[normalize-space()="Abrir contexto"]][1]',
      )
      .getByRole("button", { name: "Abrir contexto" })
      .click();
    await expect(page).toHaveURL(new RegExp(`location=${LOCATION_ID}`));
    const card = page.locator(`[data-location-id="${LOCATION_ID}"]`);
    await expect(card).toBeFocused();
    await expect.soft(card).toContainText("Ar-condicionado da recepção");
  });

  const card = page.locator(`[data-location-id="${LOCATION_ID}"]`);

  await test.step("2. Área e equipamento têm cartões diferentes", async () => {
    await expect
      .soft(page.getByRole("heading", { name: "Equipamentos" }))
      .toBeVisible();
    await expect
      .soft(card)
      .toContainText(`garantia até ${expiry.split("-").reverse().join("/")}`);
    await expect
      .soft(card.getByRole("button", { name: "Tratar garantia" }))
      .toBeVisible();
    const area = page.locator("article, li, div", { hasText: /^Recepção/ });
    await expect
      .soft(area.getByRole("button", { name: "Tratar garantia" }))
      .toHaveCount(0);
  });

  await test.step("Erro proposital: renovar com data igual à atual", async () => {
    await card.getByRole("button", { name: "Tratar garantia" }).click();
    await card.getByLabel("Decisão").selectOption("renewed");
    await card.getByLabel("Nova data de garantia").fill(expiry);
    await card.getByLabel("Justificativa").fill("Renovação sem data nova");
    await card
      .getByRole("button", { name: "Registrar decisão auditável" })
      .click();
    await expect(page.locator(".pms-alert-error").first()).toBeVisible();
    expect.soft(decisionCount()).toBe("0");
  });

  await test.step("Erros propositais: garantia sem ocorrência e substituto de outro hotel", async () => {
    const claim = await decide(page, {
      result: "claim_submitted",
      occurrence_id: "97000000-0000-4000-8000-000000000002",
    });
    expect.soft(claim.status()).toBeGreaterThanOrEqual(400);
    expect.soft(claim.status()).toBeLessThan(500);

    const replacement = await decide(page, {
      result: "replaced",
      replacement_location_id: OTHER_HOTEL_LOCATION,
    });
    expect.soft(replacement.status()).toBeGreaterThanOrEqual(400);
    expect.soft(replacement.status()).toBeLessThan(500);

    expect.soft(decisionCount(), "nada foi registrado").toBe("0");
    expect
      .soft(
        queryLocal(
          `select lifecycle_status from public.maintenance_locations where id = '${LOCATION_ID}';`,
        ),
      )
      .toBe("active");
  });

  await test.step("3-4. Registrar ciência do vencimento e revisar o histórico", async () => {
    await page.goto(SETTINGS);
    await expect(card.getByLabel("Decisão")).toBeVisible();
    await card.getByLabel("Decisão").selectOption("expiry_acknowledged");
    await card
      .getByLabel("Justificativa")
      .fill("Equipe avaliou o aviso; contrato segue vigente");
    await card
      .getByRole("button", { name: "Registrar decisão auditável" })
      .click();
    await expect(page.getByRole("status").first()).toContainText(
      "Decisão de garantia registrada",
    );
    await expect.poll(decisionCount).toBe("1");
    await card.getByText(/Histórico \(1\)/).click();
    await expect
      .soft(card, "a decisão aparece em português")
      .toContainText("Ciência do vencimento");
    await expect.soft(card).not.toContainText("expiry acknowledged");
    await expect
      .soft(card)
      .toContainText("Equipe avaliou o aviso; contrato segue vigente");
  });

  await test.step("5. A vigência tratada não gera nova pendência", async () => {
    await refreshPending(page);
    await expect.poll(openWarrantyPending).toBe("0");
    await page.goto("/dashboard/pending?status=open");
    await expect
      .soft(page.getByRole("heading", { name: "Garantia de equipamento" }))
      .toHaveCount(0);
  });

  await test.step("Banco: decisão imutável e conferência do gerente", async () => {
    const stored = queryLocal(`
      select result || '|' || warranty_ends_on from public.maintenance_warranty_decisions
      where location_id = '${LOCATION_ID}';
    `);
    expect.soft(stored).toBe(`expiry_acknowledged|${expiry}`);
    await signOut(page);
    await signIn(page, MANAGER);
    await page.goto(SETTINGS);
    await expect.soft(card).toContainText("Ar-condicionado da recepção");
    expect.soft(findInvariantViolations()).toEqual([]);
  });
});
