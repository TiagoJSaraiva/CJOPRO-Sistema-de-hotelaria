import { randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";
import {
  expect,
  findInvariantViolations,
  prepareScenario,
  queryLocal,
  signIn,
  test,
} from "./support";

// Fonte das expectativas: docs/training/lesson-06-consumption-account.md
const AURORA_ID = "10000000-0000-4000-8000-000000000001";
const STAY_ID = "91000000-0000-4000-8000-000000000002";
const HORIZON_STAY_ID = "91000000-0000-4000-8000-000000000004";
const LEGACY_ORDER_ID = "93000000-0000-4000-8000-000000000001";
const COUNTER_POINT_ID = "81000000-0000-4000-8000-000000000001";
const CAFE_POINT_ID = "81000000-0000-4000-8000-000000000002";
const WATER_ID = "40000000-0000-4000-8000-000000000001";
const WATER_OFFER_ID = "81100000-0000-4000-8000-000000000001";
const KIT_OFFER_ID = "a6100000-0000-4000-8000-000000000001";
const BACKEND_URL = `http://127.0.0.1:${process.env.JOURNEY_BACKEND_PORT || 4102}`;

type ContextOffer = {
  id: string;
  version_token: string;
  available: boolean;
  reasons: string[];
};

/** Tudo que um lançamento recusado não pode ter alterado. */
function movementSnapshot(): string {
  return queryLocal(`
    select (select count(*) from public.consumption_orders) || '|' ||
      (select count(*) from public.consumption_order_items) || '|' ||
      (select count(*) from public.stay_folio_entries) || '|' ||
      (select count(*) from public.stay_payer_allocations) || '|' ||
      (select count(*) from public.inventory_movements) || '|' ||
      (select coalesce(sum(quantity), 0) from public.inventory_positions);
  `);
}

async function postOrder(
  page: Page,
  context: BrowserContext,
  body: { stay_id: string; point_id: string; offer_id: string; token: string },
) {
  const session = (await context.cookies()).find(
    (cookie) => cookie.name === "pms_session_token",
  );
  const occurredAt = queryLocal(`
    select to_char(public.hotel_operational_now('${AURORA_ID}') at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  `);
  return page.request.post(`${BACKEND_URL}/admin/consumption-orders`, {
    headers: { authorization: `Bearer ${session?.value}` },
    data: {
      stay_id: body.stay_id,
      point_id: body.point_id,
      occurred_at: occurredAt,
      disposition: "charged",
      billing_mode: "stay_folio",
      idempotency_key: randomUUID(),
      lines: [
        { offer_id: body.offer_id, quantity: 1, version_token: body.token },
      ],
    },
  });
}

async function readContextOffers(
  page: Page,
  context: BrowserContext,
): Promise<ContextOffer[]> {
  const session = (await context.cookies()).find(
    (cookie) => cookie.name === "pms_session_token",
  );
  const response = await page.request.get(
    `${BACKEND_URL}/admin/consumption-orders/context?stay_id=${STAY_ID}`,
    { headers: { authorization: `Bearer ${session?.value}` } },
  );
  expect(response.status()).toBe(200);
  return (await response.json()).item.offers;
}

function accountSummary(page: Page) {
  const summary = page.locator('[data-usage-guide="stay-account-summary"]');
  return (label: string) =>
    summary.locator("dl > div").filter({ hasText: label }).locator("dd");
}

test("lição 6: pedidos, pagadores e conta da estadia", async ({
  page,
  context,
}) => {
  await prepareScenario("consumption-account");

  await test.step("1. Localizar a hospedagem ativa em Vendas e consumo", async () => {
    await signIn(page, "recepcao.aurora@hotelaria.local");
    await page.goto("/dashboard/consumption/launch");
    await page
      .getByRole("textbox", {
        name: "Buscar estadia por quarto, reserva ou hóspede",
      })
      .fill("LOCAL-AUR-002");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("link", { name: /Quarto 102/ }).click();
    await expect(page).toHaveURL(new RegExp(`stay_id=${STAY_ID}`));
  });

  await test.step("2. Conferir ponto, oferta, quantidade, preço e cobrança", async () => {
    await expect
      .soft(page.getByLabel("Ponto de consumo"))
      .toHaveValue(COUNTER_POINT_ID);
    const offers = page.getByLabel("Ofertas do ponto");
    await expect.soft(offers).toContainText("Agua mineral");
    await expect.soft(offers).toContainText(/R\$\s*8,00/);
    await expect
      .soft(offers, "a oferta mostra a origem do estoque")
      .toContainText("Estoque central: disponível");
    await expect
      .soft(
        page.getByRole("spinbutton", { name: "Quantidade de Agua mineral" }),
      )
      .toHaveValue("0");
    // A modalidade de cobrança só aparece depois de haver quantidade.
    const quantity = page.getByRole("spinbutton", {
      name: "Quantidade de Agua mineral",
    });
    await quantity.fill("1");
    await expect
      .soft(page.getByRole("radio", { name: "Lançamento no fólio" }))
      .toBeChecked();
    await quantity.fill("0");
  });

  await test.step("3. Consumo legado: visível como migrado, sem efeito na conta (QA-036)", async () => {
    await page.goto(
      "/dashboard/consumption/history?disposition=legacy_unclassified",
    );
    await expect
      .soft(page.getByText("Migrado sem forma de cobrança").first())
      .toBeVisible();
    const legacy = queryLocal(`
      select o.disposition || '|' || o.is_legacy || '|' || (
        select count(*) from public.stay_folio_entries e
        where e.consumption_order_id = o.id
      )
      from public.consumption_orders o where o.id = '${LEGACY_ORDER_ID}';
    `);
    expect.soft(legacy).toBe("legacy_unclassified|true|0");
  });

  await test.step("Erro proposital: oferta física sem posição ativa", async () => {
    await page.goto(`/dashboard/consumption/launch?stay_id=${STAY_ID}`);
    await page.getByLabel("Ponto de consumo").selectOption(CAFE_POINT_ID);
    const offers = page.getByLabel("Ofertas do ponto");
    await expect
      .soft(offers, "a tela explica por que o kit não pode ser lançado")
      .toContainText("Produto controlado sem origem de estoque");
    await expect
      .soft(
        page.getByRole("spinbutton", {
          name: "Quantidade de Kit de amenidades",
        }),
      )
      .toHaveCount(0);

    const before = movementSnapshot();
    const kit = (await readContextOffers(page, context)).find(
      (offer) => offer.id === KIT_OFFER_ID,
    );
    expect(kit, "a oferta do cenário existe").toBeDefined();
    expect.soft(kit?.available).toBe(false);
    const refused = await postOrder(page, context, {
      stay_id: STAY_ID,
      point_id: CAFE_POINT_ID,
      offer_id: KIT_OFFER_ID,
      token: kit?.version_token ?? "",
    });
    expect.soft(refused.ok(), "a API recusa sem passar pela tela").toBe(false);
    expect.soft(await refused.text()).toContain("offer_unavailable");
    expect.soft(movementSnapshot(), "nenhum movimento parcial").toBe(before);
  });

  await test.step("Erro proposital: estadia de outro hotel", async () => {
    await page.goto(`/dashboard/consumption/launch?stay_id=${HORIZON_STAY_ID}`);
    await expect
      .soft(page.getByText("Esta estadia não está mais disponível"))
      .toBeVisible();

    const before = movementSnapshot();
    const water = (await readContextOffers(page, context)).find(
      (offer) => offer.id === WATER_OFFER_ID,
    );
    const refused = await postOrder(page, context, {
      stay_id: HORIZON_STAY_ID,
      point_id: COUNTER_POINT_ID,
      offer_id: WATER_OFFER_ID,
      token: water?.version_token ?? "",
    });
    expect.soft(refused.status(), "a estadia alheia não existe aqui").toBe(404);
    expect.soft(movementSnapshot(), "nenhum movimento parcial").toBe(before);
  });

  await test.step("4. Adicionar água com a estadia como pagadora", async () => {
    await page.goto(`/dashboard/consumption/launch?stay_id=${STAY_ID}`);
    await page
      .getByRole("spinbutton", { name: "Quantidade de Agua mineral" })
      .fill("2");
    await page.getByRole("button", { name: "Revisar comanda" }).click();
    await expect(
      page.getByRole("dialog", { name: "Confirmar comanda" }),
    ).toContainText(/R\$\s*16,00/);
    await page.getByRole("button", { name: "Confirmar lançamento" }).click();
    await expect(page.getByText("Comanda lançada")).toBeVisible();
  });

  await test.step("Banco: pedido, itens, pagador, fólio e estoque mudam uma vez", async () => {
    const order = queryLocal(`
      select count(*) || '|' || coalesce(sum(net_amount), 0)::numeric(12,2) || '|' ||
        bool_and(disposition = 'charged' and billing_mode = 'stay_folio')
      from public.consumption_orders
      where stay_id = '${STAY_ID}' and not is_legacy;
    `);
    expect.soft(order, "um pedido de R$ 16 no fólio").toBe("1|16.00|true");

    const items = queryLocal(`
      select count(*) || '|' || coalesce(sum(i.quantity), 0)::numeric(12,0)
      from public.consumption_order_items i
      join public.consumption_orders o on o.id = i.order_id
      where o.stay_id = '${STAY_ID}' and not o.is_legacy;
    `);
    expect.soft(items, "um item com duas águas").toBe("1|2");

    const entries = queryLocal(`
      select count(*) || '|' || coalesce(sum(e.amount), 0)::numeric(12,2)
      from public.stay_folio_entries e
      join public.consumption_orders o on o.id = e.consumption_order_id
      where o.stay_id = '${STAY_ID}' and not o.is_legacy and e.direction = 'debit';
    `);
    expect.soft(entries, "um débito no fólio").toBe("1|16.00");

    const allocation = queryLocal(`
      select count(*) || '|' || coalesce(sum(a.amount), 0)::numeric(12,2)
      from public.stay_payer_allocations a
      join public.stay_folio_entries e on e.id = a.folio_entry_id
      join public.consumption_orders o on o.id = e.consumption_order_id
      where o.stay_id = '${STAY_ID}' and not o.is_legacy;
    `);
    expect
      .soft(allocation, "o débito inteiro alocado ao pagador")
      .toBe("1|16.00");

    const movement = queryLocal(`
      select count(*) || '|' || coalesce(sum(m.quantity_delta), 0)::numeric(12,0)
        || '|' || coalesce(min(m.quantity_after), 0)::numeric(12,0)
      from public.inventory_movements m
      join public.consumption_orders o on o.id = m.consumption_order_id
      where o.stay_id = '${STAY_ID}' and not o.is_legacy and m.product_id = '${WATER_ID}';
    `);
    expect.soft(movement, "saída imutável de duas águas").toBe("1|-2|16");
  });

  await test.step("5. Conferir débitos, créditos, saldo e pagadores na conta", async () => {
    await page.goto(`/dashboard/reservations/account?stay_id=${STAY_ID}`);
    const ledger = page.getByRole("region", { name: "Lançamentos da conta" });
    await expect.soft(ledger).toContainText("Hospedagem da estadia");
    await expect.soft(ledger).toContainText(/R\$\s*780,00/);
    await expect.soft(ledger).toContainText(/−\s*R\$\s*400,00/);
    await expect.soft(ledger).toContainText(/R\$\s*16,00/);
    await expect.soft(page.getByText("Subcontas por pagador")).toBeVisible();
    const orders = page
      .getByRole("article")
      .filter({ hasText: "Comandas e ajustes" });
    await expect.soft(orders).toContainText(/R\$\s*16,00/);

    // A conta é lida por pessoas: nenhum código interno aparece na tela (QA-038).
    await expect.soft(ledger).toContainText("Hospedagem");
    await expect.soft(ledger).toContainText("Pagamento");
    await expect.soft(ledger).toContainText("Consumo");
    for (const code of ["lodging", "payment", "consumption"]) {
      await expect.soft(ledger).not.toContainText(code);
    }
    await expect.soft(orders).toContainText("Lançamento no fólio");
    await expect.soft(orders).toContainText("Migrado sem forma de cobrança");
    await expect.soft(orders).not.toContainText("stay_folio");
    await expect.soft(orders).not.toContainText("legacy_unclassified");
    await expect
      .soft(page.locator('[data-usage-guide="stay-account-summary"]'))
      .not.toContainText("checked_in");
  });

  await test.step("6. O razão explica o saldo mostrado", async () => {
    const summary = accountSummary(page);
    await expect.soft(summary("Hospedagem")).toContainText(/R\$\s*780,00/);
    await expect.soft(summary("Consumo")).toContainText(/R\$\s*16,00/);
    await expect
      .soft(summary("Saldo de checkout"))
      .toContainText(/R\$\s*396,00/);
    const balance = queryLocal(`
      select coalesce(sum(case direction when 'debit' then amount else -amount end), 0)::numeric(12,2)
      from public.stay_folio_entries where stay_id = '${STAY_ID}';
    `);
    expect.soft(balance, "o razão explica o saldo mostrado").toBe("396.00");
  });

  await test.step("Invariantes de negócio ao final da jornada", async () => {
    expect.soft(findInvariantViolations()).toEqual([]);
  });
});

test("lição 6, passo 6: financeiro confere a conta da estadia", async ({
  page,
}) => {
  // QA-037: sem permissão de consulta, o passo 6 não é executável. Decisão pendente.
  test.fail();
  await prepareScenario("consumption-account");
  await signIn(page, "financeiro.aurora@hotelaria.local");
  await page.goto(`/dashboard/reservations/account?stay_id=${STAY_ID}`);
  const summary = accountSummary(page);
  await expect(summary("Hospedagem")).toContainText(/R\$\s*780,00/, {
    timeout: 5_000,
  });
  await expect(summary("Saldo de checkout")).toContainText(/R\$\s*380,00/);
});
