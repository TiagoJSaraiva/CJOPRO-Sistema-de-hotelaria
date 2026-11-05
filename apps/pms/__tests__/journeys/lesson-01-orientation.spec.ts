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

// Fonte das expectativas: docs/training/lesson-01-orientation.md
const PENDING_TITLE = "Saldo pendente no quarto 102";

async function openPending(page: Page) {
  await page
    .getByRole("navigation", { name: "Navegação principal do PMS" })
    .getByRole("link", { name: "Pendências" })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/pending/);
}

async function expectSummary(
  page: Page,
  summary: { open: number; claimed: number; resolved: number; unread: number },
) {
  const cards = page.getByRole("region", {
    name: "Resumo de pendências do hotel ativo",
  });
  const expected = [
    ["Aberta", summary.open],
    ["Assumida", summary.claimed],
    ["Resolvida", summary.resolved],
    ["Não lidas", summary.unread],
  ] as const;
  for (const [label, value] of expected) {
    await expect
      .soft(cards.getByRole("link", { name: new RegExp(`^${label}`) }))
      .toContainText(String(value));
  }
}

test("lição 1: orientação, papéis e pendências", async ({ page }) => {
  await prepareScenario("orientation");

  const item = page.locator("article").filter({ hasText: PENDING_TITLE });

  await test.step("1. Cabeçalho mostra hotel ativo e usuário", async () => {
    await signIn(page, "recepcao.aurora@hotelaria.local");
    await expect.soft(page.getByText("Hotel Aurora").first()).toBeVisible();
    await expect.soft(page.getByText("Recepção Aurora").first()).toBeVisible();
  });

  await test.step("2. Pendência da recepção está aberta e sem responsável", async () => {
    await openPending(page);
    await expect(item).toBeVisible();
    await expect.soft(item).toContainText("Não lida");
    await expect.soft(item).toContainText("Responsável: Sem responsável");
  });

  await test.step("3. Marcar lida mantém o item aberto", async () => {
    await item.getByRole("button", { name: "Marcar lida" }).click();
    await expect(item).toContainText("Lida por você");
    await expect.soft(item).toContainText("Aberta");
  });

  await test.step("4. Assumir atribui à recepção e atualiza os cards", async () => {
    await item.getByRole("button", { name: "Assumir" }).click();
    await expect(item).toContainText("Responsável: Recepção Aurora");
    await expect.soft(item).toContainText("Assumida");
    await expectSummary(page, { open: 0, claimed: 1, resolved: 0, unread: 0 });
  });

  await test.step("Opcional: devolver à fila e assumir de novo", async () => {
    await item.getByRole("button", { name: "Devolver à fila" }).click();
    await expect(item).toContainText("Responsável: Sem responsável");
    await expect.soft(item).toContainText("Lida por você");
    await expectSummary(page, { open: 1, claimed: 0, resolved: 0, unread: 0 });
    await item.getByRole("button", { name: "Assumir" }).click();
    await expect(item).toContainText("Responsável: Recepção Aurora");
  });

  await test.step("5. Abrir contexto leva à conta com saldo de R$ 380,00", async () => {
    await item.getByRole("button", { name: "Abrir contexto" }).click();
    await expect(page).toHaveURL(/\/dashboard\/reservations\/account/);
    await expect.soft(page.getByText("LOCAL-AUR-002").first()).toBeVisible();
    await expect.soft(page.getByText(/R\$\s*380,00/).first()).toBeVisible();
    await expect.soft(page.getByText(/R\$\s*780,00/).first()).toBeVisible();
    await expect.soft(page.getByText(/R\$\s*400,00/).first()).toBeVisible();
  });

  await test.step("Banco: pendência assumida pela recepção e saldo intacto", async () => {
    const assignment = queryLocal(`
      select p.status || '|' || u.email
      from public.operational_pending p
      join public.users u on u.id = p.assigned_to
      where p.title = '${PENDING_TITLE}';
    `);
    expect.soft(assignment).toBe("claimed|recepcao.aurora@hotelaria.local");
    const balance = queryLocal(`
      select coalesce(sum(case when direction = 'debit' then amount else -amount end), 0)
      from public.stay_folio_entries
      where stay_id = '91000000-0000-4000-8000-000000000002';
    `);
    expect.soft(Number(balance)).toBe(380);
  });

  await test.step("Levantamento 1 e 1.1: buscar 102 encontra a estadia e abre o lançamento", async () => {
    await page.goto("/dashboard/consumption/launch");
    await page
      .getByRole("textbox", {
        name: "Buscar estadia por quarto, reserva ou hóspede",
      })
      .fill("102");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("link", { name: /Quarto 102/ }).click();
    await expect(page).toHaveURL(
      /stay_id=91000000-0000-4000-8000-000000000002/,
    );
    await expect(
      page.getByRole("spinbutton", { name: /^Quantidade de / }).first(),
    ).toBeVisible();
  });

  await test.step("6 e erro proposital: Horizonte não enxerga o Aurora", async () => {
    await signOut(page);
    await signIn(page, "gerente.horizonte@hotelaria.local");
    await expect.soft(page.getByText("Hotel Horizonte").first()).toBeVisible();
    await expect
      .soft(page.getByText("Gerente Horizonte").first())
      .toBeVisible();
    await openPending(page);
    await expect.soft(page.getByText(PENDING_TITLE)).toHaveCount(0);
    await expect.soft(page.getByText("quarto 103")).toHaveCount(0);
    await expect.soft(page.getByText("LOCAL-AUR-002")).toHaveCount(0);
  });

  await test.step("Invariantes de negócio ao final da jornada", async () => {
    expect.soft(findInvariantViolations()).toEqual([]);
  });
});
