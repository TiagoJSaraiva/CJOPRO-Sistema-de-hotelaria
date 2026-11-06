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

// Fonte das expectativas: docs/training/lesson-07-inventory.md. Posição é produto + local. O seletor
// vazio ("Nenhuma posição configurada") é coberto em InventoryWorkspace.test.tsx: os dois hotéis
// locais têm posições, então a jornada não o alcança.
const CENTRAL = "a2000000-0000-4000-8000-000000000001";
const FRIGOBAR_101 = "a2090000-0000-4000-8000-000000000101";
const ROUTE_ID = "a20a0000-0000-4000-8000-000000000001";
const STOCK = "estoque.compras.aurora@hotelaria.local";
const GOVERNANCE = "governanca.aurora@hotelaria.local";
const INVENTORY = "/dashboard/inventory";

function quantity(position: string): number {
  return Number(
    queryLocal(
      `select quantity from public.inventory_positions where id = '${position}';`,
    ),
  );
}

function lotBalances(): number {
  return Number(
    queryLocal(`
      select coalesce(sum(b.quantity), 0) from public.inventory_lot_balances b
      where b.position_id = '${CENTRAL}';
    `),
  );
}

async function expectStatus(page: Page, text: string) {
  await expect(page.getByRole("status").first()).toContainText(text);
}

test("lição 7: posições, lotes, contagem e reposição do frigobar", async ({
  page,
}) => {
  await prepareScenario("inventory-procurement");
  let balance = quantity(CENTRAL);

  await test.step("1. Estoque mostra produto, local, posição, mínimo e ideal", async () => {
    await signIn(page, STOCK);
    await page.goto(`${INVENTORY}/overview`);
    const position = page.locator("form", {
      has: page.locator(`input[value="${CENTRAL}"]`),
    });
    await expect(position).toBeVisible();
    await expect.soft(position.getByLabel("Mínimo").first()).toHaveValue(/^8/);
    await expect.soft(position.getByLabel("Ideal").first()).toHaveValue(/^24/);
  });

  await test.step("2. Lote válido e movimento na posição central", async () => {
    await page.goto(`${INVENTORY}/lots`);
    await expect.soft(page.getByText("AUR-AGUA-001").first()).toBeVisible();
    const expiry = queryLocal(`
      select l.expires_on > public.hotel_operational_date(l.hotel_id)
      from public.inventory_lots l where l.lot_code = 'AUR-AGUA-001';
    `);
    expect.soft(expiry, "a validade é posterior à data do hotel").toBe("t");

    await page.goto(`${INVENTORY}/movements`);
    await expect
      .soft(page.getByLabel("Posição").first().locator("option").first())
      .toContainText("·");
    await page.getByLabel("Tipo").selectOption("receipt");
    await page.getByLabel("Posição").first().selectOption(CENTRAL);
    await page.getByLabel("Quantidade").first().fill("5");
    await page.getByLabel("Custo unitário").fill("3");
    await page.getByLabel("Motivo").first().fill("Entrada da lição 7");
    await page.getByRole("button", { name: "Registrar" }).click();
    await expectStatus(page, "Movimento registrado");
    balance += 5;
    expect.soft(quantity(CENTRAL)).toBe(balance);
    expect.soft(lotBalances(), "o lote acompanha a posição").toBe(balance);
  });

  await test.step("Erro proposital: saída maior que o saldo não infla nem negativa", async () => {
    await page.getByLabel("Tipo").selectOption("loss");
    await page.getByLabel("Posição").first().selectOption(CENTRAL);
    await page.getByLabel("Quantidade").first().fill("9999");
    await page.getByLabel("Motivo").first().fill("Perda maior que o saldo");
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(
      page.getByText("O saldo por lote não cobre a quantidade"),
    ).toBeVisible();
    expect.soft(quantity(CENTRAL)).toBe(balance);
  });

  await test.step("3. Contagem com diferença justificada", async () => {
    await page.goto(`${INVENTORY}/counts`);
    await page.getByRole("combobox", { name: "Local" }).selectOption({
      label: "Estoque central",
    });
    await page.getByLabel("Observações").fill("Contagem da lição 7");
    await page.getByRole("button", { name: "Abrir contagem" }).click();
    await expectStatus(page, "Registro criado");
    const field = page.getByLabel(
      /Agua mineral · esperado|Água mineral · esperado/,
    );
    await expect(field).toBeVisible();
    await field.fill(String(balance - 1));
    await field
      .locator("xpath=ancestor::form[1]")
      .getByRole("button", { name: "Salvar contagem" })
      .click();
    await expectStatus(page, "Alteração salva");
    // Os demais itens do local ficam com o valor esperado.
    const others = page.locator("form", {
      has: page.getByRole("button", { name: "Salvar contagem" }),
    });
    const total = await others.count();
    for (let index = 0; index < total; index += 1) {
      const input = others.nth(index).locator('input[name="counted_quantity"]');
      if ((await input.inputValue()) !== "") continue;
      const label = (await others.nth(index).textContent()) ?? "";
      await input.fill(/esperado\s*([\d.]+)/.exec(label)?.[1] ?? "0");
      await others
        .nth(index)
        .getByRole("button", { name: "Salvar contagem" })
        .click();
      await expectStatus(page, "Alteração salva");
    }
    await page.getByRole("button", { name: "Concluir" }).click();
    await expectStatus(page, "Alteração salva");
    await expect
      .poll(() => quantity(CENTRAL), "a diferença entra no saldo")
      .toBe(balance - 1);
    balance -= 1;
    expect.soft(lotBalances()).toBe(balance);
  });

  await test.step("4. Composição do frigobar configurada", async () => {
    await page.goto(`${INVENTORY}/minibar`);
    await expect
      .soft(
        page.getByRole("heading", { name: "Composição por tipo de quarto" }),
      )
      .toBeVisible();
  });

  await test.step("5. Governança assume e conclui a reposição, com a origem certa", async () => {
    await signOut(page);
    await signIn(page, GOVERNANCE);
    await page.goto(`${INVENTORY}/minibar`);
    const route = page.getByTestId("minibar-route").first();
    await expect(route).toContainText("Estoque central");
    await expect.soft(route).toContainText("Aguardando responsável");
    await expect.soft(route).toContainText(/Quarto 101: 2 ×/);
    await route.getByRole("button", { name: "Assumir rota" }).click();
    await expectStatus(page, "Alteração salva");
    await expect
      .soft(page.getByTestId("minibar-route").first())
      .toContainText("Em andamento");
    await page
      .getByTestId("minibar-route")
      .first()
      .getByRole("button", { name: "Concluir reposição" })
      .click();
    await expectStatus(page, "Alteração salva");
    await expect
      .poll(() =>
        queryLocal(
          `select status from public.minibar_replenishment_routes where id = '${ROUTE_ID}';`,
        ),
      )
      .toBe("completed");
    balance -= 2;
    expect.soft(quantity(CENTRAL)).toBe(balance);
    expect.soft(quantity(FRIGOBAR_101)).toBe(2);
    await expect.soft(page.getByTestId("minibar-route")).toHaveCount(0);
  });

  await test.step("6. Movimentos e saldo por lote conferem", async () => {
    expect.soft(lotBalances()).toBe(balance);
    const trail = queryLocal(`
      select string_agg(kind::text, ',' order by kind)
      from (select distinct kind from public.inventory_movements
            where position_id = '${CENTRAL}') kinds;
    `);
    expect.soft(trail).toContain("transfer_out");
    await signOut(page);
    await signIn(page, STOCK);
    await page.goto(`${INVENTORY}/movements`);
    await expect
      .soft(page.getByText("Reposição de frigobar").first())
      .toBeVisible();
    expect.soft(findInvariantViolations()).toEqual([]);
  });
});
