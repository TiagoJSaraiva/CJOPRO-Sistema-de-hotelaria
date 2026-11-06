import type { BrowserContext, Locator, Page } from "@playwright/test";
import {
  expect,
  findInvariantViolations,
  prepareScenario,
  queryLocal,
  signIn,
  signOut,
  test,
} from "./support";

// Fonte das expectativas: docs/training/lesson-08-procurement.md. Estoque solicita e recebe, gerente
// aprova, financeiro confere e liquida. O pedido é de 10 unidades a R$ 3,00, e a nota, de R$ 30,00.
const AURORA_ID = "10000000-0000-4000-8000-000000000001";
const CENTRAL = "a2000000-0000-4000-8000-000000000001";
const BACKEND_URL = `http://127.0.0.1:${process.env.JOURNEY_BACKEND_PORT || 4102}`;
const STOCK = "estoque.compras.aurora@hotelaria.local";
const MANAGER = "gerente.aurora@hotelaria.local";
const FINANCE = "financeiro.aurora@hotelaria.local";
const PROCUREMENT = "/dashboard/procurement";

function quantity(): number {
  return Number(
    queryLocal(
      `select quantity from public.inventory_positions where id = '${CENTRAL}';`,
    ),
  );
}

function order(): string {
  return queryLocal(`
    select id || '|' || status || '|' || version from public.purchase_orders
    where hotel_id = '${AURORA_ID}' order by created_at desc limit 1;
  `);
}
const orderField = (index: number) => order().split("|")[index] ?? "";

async function switchTo(page: Page, email: string) {
  await signOut(page);
  await signIn(page, email);
  await page.goto(PROCUREMENT);
}

async function expectSuccess(page: Page, text: string) {
  await expect(page.getByRole("status").first()).toContainText(text);
}

async function option(field: Locator, text: string | RegExp) {
  const label = await field
    .locator("option")
    .filter({ hasText: text })
    .first()
    .textContent();
  await field.selectOption({ label: (label ?? "").trim() });
}

async function api(
  page: Page,
  context: BrowserContext,
  path: string,
  data: unknown,
) {
  const session = (await context.cookies()).find(
    (cookie) => cookie.name === "pms_session_token",
  );
  return page.request.post(`${BACKEND_URL}/admin/${path}`, {
    headers: { authorization: `Bearer ${session?.value}` },
    data,
  });
}

test("lição 8: da reposição à conta do fornecedor", async ({
  page,
  context,
  diagnostics,
}) => {
  await prepareScenario("inventory-procurement");
  diagnostics.allow(/purchase-orders.*(actions|receipts)/);
  const start = quantity();

  await test.step("1-2. Estoque cria a reposição e compara a necessidade", async () => {
    await signIn(page, STOCK);
    await page.goto(PROCUREMENT);
    const form = page.locator("form", {
      has: page.getByRole("button", { name: "Criar solicitação" }),
    });
    await option(form.getByLabel("Produto"), /gua mineral/);
    await form.getByLabel("Destino").selectOption({ label: "Estoque central" });
    await form.getByLabel("Quantidade").fill("10");
    await form.getByLabel("Prioridade").selectOption("high");
    await form.getByLabel("Motivo").fill("Reposição da lição 8");
    await form.getByRole("button", { name: "Criar solicitação" }).click();
    await expectSuccess(page, "Registro criado");

    const card = page.locator("article", { hasText: "un." }).first();
    await expect.soft(card).toContainText("10");
    await expect.soft(card, "prioridade").toContainText("Alta");
    await expect.soft(card, "saldo").toContainText("Saldo 18");
    await expect.soft(card, "mínimo").toContainText("mínimo 8");
    await expect.soft(card, "ideal").toContainText("ideal 24");
    await expect.soft(card, "situação em português").toContainText("Rascunho");

    await card.getByRole("button", { name: "Enviar" }).click();
    await expectSuccess(page, "Alteração salva");
  });

  await test.step("3. Pedido com fornecedor sintético", async () => {
    const form = page.locator("form", {
      has: page.getByRole("button", { name: "Criar pedido" }),
    });
    await option(form.locator('select[name="supplier_id"]'), /Suprimentos/);
    await option(form.getByLabel("Produto"), /gua mineral/);
    await form.getByLabel("Destino").selectOption({ label: "Estoque central" });
    await form.getByLabel("Quantidade").fill("10");
    await form
      .getByLabel(/Preço|Valor unit|unitário/i)
      .first()
      .fill("3");
    await form.getByRole("button", { name: "Criar pedido" }).click();
    await expectSuccess(page, "Pedido de compra criado");
    await page
      .locator("article", { hasText: "Suprimentos" })
      .first()
      .getByRole("button", { name: "Enviar" })
      .click();
    await expectSuccess(page, "Alteração salva");
    await expect.poll(() => orderField(1)).toBe("pending_approval");
  });

  await test.step("4. Quem solicita não aprova; o gerente aprova", async () => {
    const card = page.locator("article", { hasText: "Suprimentos" }).first();
    await expect
      .soft(card.getByRole("button", { name: "Aprovar" }))
      .toHaveCount(0);
    const refused = await api(
      page,
      context,
      `procurement/purchase-orders/${orderField(0)}/actions`,
      {
        action: "approve",
        expected_version: Number(orderField(2)),
        reason: "Aprovando o próprio pedido",
      },
    );
    expect.soft(refused.status()).toBe(403);
    expect.soft(orderField(1)).toBe("pending_approval");

    await switchTo(page, MANAGER);
    await page
      .locator("article", { hasText: "Suprimentos" })
      .first()
      .getByRole("button", { name: "Aprovar" })
      .click();
    await expectSuccess(page, "Alteração salva");
    await expect.poll(() => orderField(1)).toBe("approved");
  });

  await test.step("5a. Estoque emite o pedido", async () => {
    await switchTo(page, STOCK);
    await page
      .locator("article", { hasText: "Suprimentos" })
      .first()
      .getByRole("button", { name: "Emitir" })
      .click();
    await expectSuccess(page, "Alteração salva");
    await expect.poll(() => orderField(1)).toBe("issued");
    expect.soft(quantity(), "emitir não movimenta estoque").toBe(start);
  });

  const receipt = () =>
    page.locator("form", {
      has: page.getByRole("button", { name: "Registrar recebimento" }),
    });

  await test.step("Erro proposital: receber mais que o autorizado", async () => {
    await receipt().getByLabel("Aceita").fill("999");
    await receipt()
      .getByRole("button", { name: "Registrar recebimento" })
      .click();
    await expect(page.getByText("não cabe no saldo do pedido")).toBeVisible();
    expect.soft(quantity(), "o estoque não infla").toBe(start);
    expect.soft(orderField(1)).toBe("issued");
  });

  await test.step("5b. Recebimento parcial e depois o saldo", async () => {
    await receipt().getByLabel("Aceita").fill("4");
    await receipt()
      .getByRole("button", { name: "Registrar recebimento" })
      .click();
    await expectSuccess(page, "Recebimento registrado");
    await expect.poll(() => orderField(1)).toBe("partially_received");
    expect.soft(quantity()).toBe(start + 4);

    await receipt().getByLabel("Aceita").fill("6");
    await receipt()
      .getByRole("button", { name: "Registrar recebimento" })
      .click();
    await expectSuccess(page, "Recebimento registrado");
    await expect.poll(() => orderField(1)).toBe("received");
    expect.soft(quantity()).toBe(start + 10);
  });

  await test.step("6. Financeiro confere a nota, as tolerâncias e o vencimento, e liquida", async () => {
    await switchTo(page, FINANCE);
    const today = queryLocal(
      `select public.hotel_operational_date('${AURORA_ID}');`,
    );
    const due = queryLocal(
      `select public.hotel_operational_date('${AURORA_ID}') + 15;`,
    );
    const form = page.locator("form", {
      has: page.getByRole("button", { name: "Registrar nota" }),
    });
    await form.getByLabel("Número da nota").fill("NF-0008");
    await form.getByLabel("Emissão").fill(today);
    await form.getByLabel("Vencimento").fill(due);
    await form.getByLabel("Valor total").fill("30");
    await form.getByRole("button", { name: "Registrar nota" }).click();
    await expectSuccess(page, "Nota registrada");

    const invoice = page.locator("article", { hasText: "Nota NF-0008" });
    await expect.soft(invoice).toContainText("R$ 30,00");
    // Quem registrou a nota não a aprova.
    await expect.soft(invoice).toContainText("Outra pessoa precisa aprová-la");
    await expect
      .soft(invoice.getByRole("button", { name: "Aprovar nota" }))
      .toHaveCount(0);

    await switchTo(page, MANAGER);
    const review = page.locator("article", { hasText: "Nota NF-0008" });
    await review.getByLabel("Justificativa").fill("Nota confere com o pedido");
    await review.getByRole("button", { name: "Aprovar nota" }).click();
    await expectSuccess(page, "Nota atualizada");

    await switchTo(page, FINANCE);
    const payable = page.locator("article", { hasText: "Nota NF-0008" });
    await payable.getByLabel("Valor", { exact: true }).fill("30");
    await payable.getByRole("button", { name: "Registrar pagamento" }).click();
    await expectSuccess(page, "Pagamento registrado");
    await expect
      .poll(() =>
        queryLocal(`
          select status from public.procurement_invoices
          where invoice_number = 'NF-0008' and hotel_id = '${AURORA_ID}';
        `),
      )
      .toBe("paid");
  });

  await test.step("Banco: atores distintos, conta rastreável e invariantes", async () => {
    const paid = queryLocal(`
      select d.paid_amount::numeric(12,2) from public.procurement_invoice_due_dates d
      join public.procurement_invoices i on i.id = d.invoice_id
      where i.invoice_number = 'NF-0008';
    `);
    expect.soft(paid).toBe("30.00");
    const approver = queryLocal(`
      select u.email from public.purchase_order_approvals a
      join public.users u on u.id = a.actor_id
      where a.purchase_order_id = '${orderField(0)}';
    `);
    expect.soft(approver).toBe(MANAGER);
    expect.soft(findInvariantViolations()).toEqual([]);
  });
});
