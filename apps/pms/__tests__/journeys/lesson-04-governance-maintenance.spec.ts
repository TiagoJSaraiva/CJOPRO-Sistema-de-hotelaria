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

// Fonte das expectativas: docs/training/lesson-04-governance-maintenance.md. Concluir a ordem,
// aprovar a inspeção, liberar o bloqueio e inspecionar o quarto são ações distintas.
const AURORA_ID = "10000000-0000-4000-8000-000000000001";
const OCCURRENCE_ID = "a1100000-0000-4000-8000-000000000001";
const TECHNICIAN = "tecnico.aurora@hotelaria.local";
const SUPERVISOR = "supervisor.manutencao.aurora@hotelaria.local";
const GOVERNANCE = "governanca.aurora@hotelaria.local";
const OCCURRENCE = `/dashboard/maintenance/occurrences/${OCCURRENCE_ID}`;

function workOrder(): string {
  return queryLocal(`
    select id || '|' || status from public.maintenance_work_orders
    where occurrence_id = '${OCCURRENCE_ID}';
  `);
}
const orderId = () => workOrder().split("|")[0] ?? "";
const orderStatus = () => workOrder().split("|")[1] ?? "";

function block(): string {
  return queryLocal(`
    select id || '|' || (released_at is not null) from public.room_blocks
    where maintenance_occurrence_id = '${OCCURRENCE_ID}';
  `);
}
const blockId = () => block().split("|")[0] ?? "";
const blockReleased = () => block().split("|")[1] ?? "";

function cycle(): string {
  return queryLocal(`
    select c.status from public.governance_cycles c
    join public.rooms r on r.id = c.room_id
    where r.room_number = '103' and r.hotel_id = '${AURORA_ID}'
    order by c.created_at desc limit 1;
  `);
}

async function switchTo(page: Page, email: string, path: string) {
  await signOut(page);
  await signIn(page, email);
  await page.goto(path);
}

async function decide(page: Page, fields: Record<string, string>) {
  const dialog = page.getByRole("dialog");
  for (const [label, value] of Object.entries(fields))
    await dialog.getByLabel(label).fill(value);
  await dialog.getByRole("button", { name: "Confirmar decisão" }).click();
  await expect(dialog).toBeHidden();
}

test("lição 4: da retenção técnica à prontidão do quarto 103", async ({
  page,
  diagnostics,
}) => {
  await prepareScenario("governance-maintenance");
  // Os erros propositais recebem recusa do backend.
  diagnostics.allow(/room-blocks\/.*\/release|work-orders\/.*\/inspect/);
  diagnostics.allow(/status of (400|403|409)/);

  await test.step("Estado inicial: quarto retido e ligado à ocorrência", async () => {
    await signIn(page, TECHNICIAN);
    await page.goto(OCCURRENCE);
    await expect.soft(page.getByText("MAN-001103").first()).toBeVisible();
    await expect.soft(page.getByText("Quarto 103").first()).toBeVisible();
    expect.soft(orderStatus()).toBe("assigned");
    expect.soft(blockReleased()).toBe("false");
    expect.soft(cycle()).toBe("maintenance_hold");
  });

  await test.step("Erro proposital: o técnico não inspeciona a própria ordem", async () => {
    await expect
      .soft(page.getByRole("button", { name: "Aprovar inspeção" }))
      .toHaveCount(0);
    const refused = await page.request.post(
      `/api/maintenance/work-orders/${orderId()}/inspect`,
      { data: { result: "approved", notes: "Inspecionando a mim mesmo" } },
    );
    expect.soft(refused.status()).toBeGreaterThanOrEqual(400);
    expect.soft(orderStatus()).toBe("assigned");
  });

  await test.step("1-2. Técnico conclui checklist, diagnóstico e serviço", async () => {
    await page.getByRole("button", { name: "Iniciar serviço" }).click();
    await expect.poll(orderStatus).toBe("in_progress");
    const boxes = page.getByRole("checkbox");
    const total = await boxes.count();
    for (let index = 0; index < total; index += 1) {
      await boxes.nth(index).check();
      await expect(boxes.nth(index)).toBeChecked();
      await expect(boxes.nth(index)).toBeEnabled();
    }
    await page.getByRole("button", { name: "Concluir execução" }).click();
    await decide(page, {
      Diagnóstico: "Fechadura com mola desgastada",
      "Serviço realizado": "Troca da mola e teste de abertura",
    });
    await expect.poll(orderStatus).toBe("awaiting_inspection");
    await expect
      .soft(page.getByRole("button", { name: "Aprovar inspeção" }))
      .toHaveCount(0);
    expect.soft(blockReleased()).toBe("false");
  });

  await test.step("Erros propositais: liberar com ordem aberta ou sem justificativa", async () => {
    await switchTo(page, SUPERVISOR, OCCURRENCE);
    const blockCard = page.locator(
      '[data-usage-guide="maintenance-occurrence-block"]',
    );
    await blockCard
      .getByLabel("Justificativa da liberação técnica")
      .fill("Tentativa com a inspeção pendente");
    await blockCard
      .getByRole("button", { name: "Liberar para inspeção da governança" })
      .click();
    await expect(page.locator(".pms-alert-error")).toBeVisible();
    expect.soft(blockReleased()).toBe("false");
    expect.soft(cycle()).toBe("maintenance_hold");

    const withoutReason = await page.request.post(
      `/api/maintenance/room-blocks/${blockId()}/release`,
      { data: { reason: "   " } },
    );
    expect.soft(withoutReason.status()).toBe(400);
    expect.soft(blockReleased()).toBe("false");
  });

  await test.step("3. Supervisor aprova a inspeção", async () => {
    await page.goto(OCCURRENCE);
    await page.getByRole("button", { name: "Aprovar inspeção" }).click();
    await decide(page, {
      "Justificativa / observação": "Evidências conferidas no local",
    });
    await expect.poll(orderStatus).toBe("completed");
    expect.soft(blockReleased(), "aprovar não libera o quarto").toBe("false");
    expect.soft(cycle()).toBe("maintenance_hold");
  });

  await test.step("4. Liberar com justificativa cria a inspeção final", async () => {
    const blockCard = page.locator(
      '[data-usage-guide="maintenance-occurrence-block"]',
    );
    await blockCard
      .getByLabel("Justificativa da liberação técnica")
      .fill("Fechadura testada e aprovada");
    await blockCard
      .getByRole("button", { name: "Liberar para inspeção da governança" })
      .click();
    await expect(page.getByRole("status").first()).toContainText(
      "A inspeção final da governança foi criada",
    );
    await expect.poll(blockReleased).toBe("true");
    await expect.poll(cycle).not.toBe("maintenance_hold");
    expect
      .soft(cycle(), "liberar não deixa o quarto pronto")
      .not.toBe("released");
  });

  await test.step("5-6. Governança inspeciona o quarto; quem executou não aprova sozinho", async () => {
    await switchTo(page, GOVERNANCE, "/dashboard/governance");
    const card = page.locator('[data-usage-guide="governance-task"]', {
      hasText: "Quarto 103",
    });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Assumir" }).click();
    await expect(card.getByRole("button", { name: "Iniciar" })).toBeVisible();
    await card.getByRole("button", { name: "Iniciar" }).click();
    await card
      .getByLabel("Observação da inspeção")
      .fill("Quarto conferido e sem pendências");
    await card.getByRole("button", { name: "Aprovar e liberar" }).click();
    await expect.poll(cycle).toBe("released");
  });

  await test.step("Banco: quarto pronto, cada etapa auditável e invariantes", async () => {
    const readiness = queryLocal(`
      select count(*) from public.room_blocks b
      join public.rooms r on r.id = b.room_id
      where r.room_number = '103' and b.released_at is null;
    `);
    expect.soft(readiness, "nenhum bloqueio ativo no 103").toBe("0");
    const audit = queryLocal(`
      select release_reason from public.room_blocks
      where maintenance_occurrence_id = '${OCCURRENCE_ID}';
    `);
    expect.soft(audit).toBe("Fechadura testada e aprovada");
    expect.soft(findInvariantViolations()).toEqual([]);
  });
});
