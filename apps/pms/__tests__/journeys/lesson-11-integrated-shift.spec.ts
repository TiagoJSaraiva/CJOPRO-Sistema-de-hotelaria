import type { Page } from "@playwright/test";
import {
  advanceClock,
  expect,
  findInvariantViolations,
  prepareScenario,
  queryLocal,
  signIn,
  signOut,
  test,
} from "./support";

// Fonte das expectativas: docs/training/lesson-11-integrated-shift.md. As oito contas trabalham no
// mesmo turno, na ordem das dependências. Cada módulo tem a própria jornada: aqui importa o que
// acontece quando um depende do outro, e que as pendências sejam encerradas pela origem.
const AURORA_ID = "10000000-0000-4000-8000-000000000001";
const ARRIVAL_STAY = "91000000-0000-4000-8000-000000000001";
const HOUSE_STAY = "91000000-0000-4000-8000-000000000002";
const CENTRAL = "a2000000-0000-4000-8000-000000000001";
const FRIGOBAR_101 = "a2090000-0000-4000-8000-000000000101";
const OCCURRENCE_ID = "a1100000-0000-4000-8000-000000000001";
const ORDER_ID = "a4010000-0000-4000-8000-000000000001";
const ROUTE_ID = "a20a0000-0000-4000-8000-000000000001";
const LOCATION_ID = "99500000-0000-4000-8000-000000000001";
const HORIZON_OCCURRENCE = "97000000-0000-4000-8000-000000000001";

const RECEPTION = "recepcao.aurora@hotelaria.local";
const GOVERNANCE = "governanca.aurora@hotelaria.local";
const TECHNICIAN = "tecnico.aurora@hotelaria.local";
const SUPERVISOR = "supervisor.manutencao.aurora@hotelaria.local";
const STOCK = "estoque.compras.aurora@hotelaria.local";
const CASHIER = "caixa.aurora@hotelaria.local";
const FINANCE = "financeiro.aurora@hotelaria.local";
const MANAGER = "gerente.aurora@hotelaria.local";
const HORIZON = "gerente.horizonte@hotelaria.local";

function value(sql: string): string {
  return queryLocal(sql);
}
const stockAt = (position: string) =>
  Number(
    value(
      `select quantity from public.inventory_positions where id = '${position}';`,
    ),
  );
const lotStock = () =>
  Number(
    value(`
      select coalesce(sum(quantity), 0) from public.inventory_lot_balances
      where position_id = '${CENTRAL}';
    `),
  );
const orderStatus = () =>
  value(`select status from public.purchase_orders where id = '${ORDER_ID}';`);

async function switchTo(page: Page, email: string, path: string) {
  await signOut(page);
  await signIn(page, email);
  await page.goto(path);
}

async function expectStatus(page: Page, text: string) {
  await expect(page.getByRole("status").first()).toContainText(text);
}

async function decide(page: Page, fields: Record<string, string>) {
  const dialog = page.getByRole("dialog");
  for (const [label, text] of Object.entries(fields))
    await dialog.getByLabel(label).fill(text);
  await dialog.getByRole("button", { name: "Confirmar decisão" }).click();
  await expect(dialog).toBeHidden();
}

test("lição 11: turno integrado com as oito contas", async ({
  page,
  diagnostics,
}) => {
  test.setTimeout(600_000);
  await prepareScenario("integrated-shift");
  page.on("dialog", (dialog) => void dialog.accept());
  diagnostics.allow(/Failed to load resource/);
  const date = value(`select public.hotel_operational_date('${AURORA_ID}');`);
  const startStock = stockAt(CENTRAL);

  await test.step("1. Recepção prepara a chegada e lança o consumo autorizado", async () => {
    await signIn(page, RECEPTION);
    await page.goto("/dashboard/reservations/view");
    const panel = page.getByTestId("reservation-side-panel");
    await page
      .getByRole("button", { name: /Abrir reserva LOCAL-AUR-001/ })
      .first()
      .click();
    await expect(panel).toContainText("LOCAL-AUR-001");
    await panel.getByLabel("Meio de pagamento recebido").selectOption("pix");
    await panel
      .getByRole("button", { name: "Registrar adiantamento recebido" })
      .click();
    await expect(panel).toContainText("Exigência atendida");
    await panel.getByRole("button", { name: "Check-in", exact: true }).click();
    await expect
      .poll(() =>
        value(
          `select stay_status from public.stays where id = '${ARRIVAL_STAY}';`,
        ),
      )
      .toBe("checked_in");

    // Água controlada por lote: a venda baixa a posição e o lote juntos.
    await page.goto(`/dashboard/consumption/launch?stay_id=${HOUSE_STAY}`);
    const quantity = page.getByRole("spinbutton", {
      name: "Quantidade de Agua mineral",
    });
    await expect(async () => {
      await quantity.fill("1");
      await expect(
        page.getByRole("radio", { name: "Lançamento no fólio" }),
      ).toBeChecked({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await page.getByRole("button", { name: "Revisar comanda" }).click();
    await page.getByRole("button", { name: "Confirmar lançamento" }).click();
    await expect(page.getByText("Comanda lançada")).toBeVisible();
    expect.soft(stockAt(CENTRAL)).toBe(startStock - 1);
    expect.soft(lotStock(), "o lote acompanha a venda").toBe(startStock - 1);
  });

  await test.step("2. Governança repõe o frigobar", async () => {
    await switchTo(page, GOVERNANCE, "/dashboard/inventory/minibar");
    await page
      .getByTestId("minibar-route")
      .first()
      .getByRole("button", { name: "Assumir rota" })
      .click();
    await expectStatus(page, "Alteração salva");
    await page
      .getByTestId("minibar-route")
      .first()
      .getByRole("button", { name: "Concluir reposição" })
      .click();
    await expectStatus(page, "Alteração salva");
    await expect
      .poll(() =>
        value(
          `select status from public.minibar_replenishment_routes where id = '${ROUTE_ID}';`,
        ),
      )
      .toBe("completed");
    expect.soft(stockAt(FRIGOBAR_101)).toBe(2);
    expect.soft(stockAt(CENTRAL)).toBe(startStock - 3);
  });

  const occurrence = `/dashboard/maintenance/occurrences/${OCCURRENCE_ID}`;

  await test.step("3. Técnico executa; supervisor inspeciona, libera e decide a garantia", async () => {
    await switchTo(page, TECHNICIAN, occurrence);
    await expect
      .soft(page.getByRole("button", { name: "Aprovar inspeção" }))
      .toHaveCount(0);
    await page.getByRole("button", { name: "Iniciar serviço" }).click();
    await expect
      .poll(() =>
        value(`
          select status from public.maintenance_work_orders
          where occurrence_id = '${OCCURRENCE_ID}';
        `),
      )
      .toBe("in_progress");
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

    await switchTo(page, SUPERVISOR, occurrence);
    await page.getByRole("button", { name: "Aprovar inspeção" }).click();
    await decide(page, {
      "Justificativa / observação": "Evidências conferidas no local",
    });
    const block = page.locator(
      '[data-usage-guide="maintenance-occurrence-block"]',
    );
    await block
      .getByLabel("Justificativa da liberação técnica")
      .fill("Fechadura testada e aprovada");
    await block
      .getByRole("button", { name: "Liberar para inspeção da governança" })
      .click();
    await expectStatus(page, "A inspeção final da governança foi criada");

    await page.goto(`/dashboard/maintenance/settings?location=${LOCATION_ID}`);
    const card = page.locator(`[data-location-id="${LOCATION_ID}"]`);
    await expect(card.getByLabel("Decisão")).toBeVisible();
    await card.getByLabel("Decisão").selectOption("expiry_acknowledged");
    await card.getByLabel("Justificativa").fill("Equipe avaliou o aviso");
    await card
      .getByRole("button", { name: "Registrar decisão auditável" })
      .click();
    await expectStatus(page, "Decisão de garantia registrada");
  });

  await test.step("3b. Governança inspeciona o quarto liberado", async () => {
    await switchTo(page, GOVERNANCE, "/dashboard/governance");
    const card = page.locator('[data-usage-guide="governance-task"]', {
      hasText: "Quarto 103",
    });
    await card.getByRole("button", { name: "Assumir" }).click();
    await card.getByRole("button", { name: "Iniciar" }).click();
    await card
      .getByLabel("Observação da inspeção")
      .fill("Quarto conferido e sem pendências");
    await card.getByRole("button", { name: "Aprovar e liberar" }).click();
    await expect
      .poll(() =>
        value(`
          select c.status from public.governance_cycles c
          join public.rooms r on r.id = c.room_id
          where r.room_number = '103' and r.hotel_id = '${AURORA_ID}'
          order by c.created_at desc limit 1;
        `),
      )
      .toBe("released");
  });

  await test.step("4. Gerente aprova a compra; estoque emite e recebe", async () => {
    await switchTo(page, STOCK, "/dashboard/procurement");
    await expect
      .soft(
        page
          .locator("article", { hasText: "Suprimentos" })
          .first()
          .getByRole("button", { name: "Aprovar" }),
        "quem pede não aprova",
      )
      .toHaveCount(0);

    await switchTo(page, MANAGER, "/dashboard/procurement");
    await page
      .locator("article", { hasText: "Suprimentos" })
      .first()
      .getByRole("button", { name: "Aprovar" })
      .click();
    await expectStatus(page, "Alteração salva");
    await expect.poll(orderStatus).toBe("approved");

    await switchTo(page, STOCK, "/dashboard/procurement");
    await page
      .locator("article", { hasText: "Suprimentos" })
      .first()
      .getByRole("button", { name: "Emitir" })
      .click();
    await expectStatus(page, "Alteração salva");
    const receipt = page.locator("form", {
      has: page.getByRole("button", { name: "Registrar recebimento" }),
    });
    await receipt.getByLabel("Aceita").fill("6");
    await receipt
      .getByRole("button", { name: "Registrar recebimento" })
      .click();
    await expectStatus(page, "Recebimento registrado");
    await expect.poll(orderStatus).toBe("received");
    expect.soft(stockAt(CENTRAL)).toBe(startStock - 3 + 6);
    expect
      .soft(lotStock(), "lote e posição conciliados")
      .toBe(stockAt(CENTRAL));
  });

  const register = () =>
    page.getByRole("article").filter({ hasText: "REC-01" });

  await test.step("5. Caixa opera e conta sem ver o esperado", async () => {
    await switchTo(page, CASHIER, "/dashboard/cash");
    await register().getByLabel("Fundo inicial").fill("100");
    await register().getByRole("button", { name: "Abrir sessão" }).click();
    await expect(register()).toContainText("Sessão aberta");
    await expect
      .soft(register())
      .toContainText("valor esperado protegido até a contagem");
    await register().getByLabel("Valor contado").fill("100");
    await register()
      .getByRole("button", { name: "Enviar contagem cega" })
      .click();
    await expect
      .poll(() =>
        value(`
          select s.status from public.cash_sessions s
          join public.cash_registers r on r.id = s.cash_register_id
          where r.code = 'REC-01' order by s.opened_at desc limit 1;
        `),
      )
      .toBe("closed");
  });

  await test.step("6. Financeiro trata a nota e o parceiro", async () => {
    await switchTo(page, FINANCE, "/dashboard/procurement");
    const form = page.locator("form", {
      has: page.getByRole("button", { name: "Registrar nota" }),
    });
    await form.getByLabel("Número da nota").fill("NF-0011");
    await form.getByLabel("Emissão").fill(date);
    await form
      .getByLabel("Vencimento")
      .fill(
        value(`select public.hotel_operational_date('${AURORA_ID}') + 15;`),
      );
    await form.getByLabel("Valor total").fill("18");
    await form.getByRole("button", { name: "Registrar nota" }).click();
    await expectStatus(page, "Nota registrada");

    await page.goto("/dashboard/consumption/settlements");
    await page.getByRole("button", { name: "Gerar apuração" }).click();
    await page.getByRole("button", { name: "Enviar para revisão" }).click();
    await expect
      .poll(() =>
        value(`
          select status from public.partner_settlements
          where hotel_id = '${AURORA_ID}' order by created_at desc limit 1;
        `),
      )
      .not.toBe("draft");
  });

  await test.step("7a. Gerente aprova a nota e a apuração", async () => {
    await switchTo(page, MANAGER, "/dashboard/procurement");
    const invoice = page.locator("article", { hasText: "Nota NF-0011" });
    await invoice.getByLabel("Justificativa").fill("Nota confere com o pedido");
    await invoice.getByRole("button", { name: "Aprovar nota" }).click();
    await expectStatus(page, "Nota atualizada");

    const settlement = value(`
      select id from public.partner_settlements
      where hotel_id = '${AURORA_ID}' order by created_at desc limit 1;
    `);
    await page.goto(`/dashboard/consumption/settlements?id=${settlement}`);
    await page.getByRole("button", { name: "Aprovar" }).click();
    await expect
      .poll(() =>
        value(`
          select status from public.partner_settlements
          where hotel_id = '${AURORA_ID}' order by created_at desc limit 1;
        `),
      )
      .toBe("approved");
  });

  await test.step("6b. Financeiro paga a nota e prepara o dia", async () => {
    await switchTo(page, FINANCE, "/dashboard/procurement");
    const payable = page.locator("article", { hasText: "Nota NF-0011" });
    await payable.getByLabel("Valor", { exact: true }).fill("18");
    await payable.getByRole("button", { name: "Registrar pagamento" }).click();
    await expectStatus(page, "Pagamento registrado");

    await page.goto(`/dashboard/cash?date=${date}`);
    await page.getByRole("button", { name: "Preparar fechamento" }).click();
    await expect
      .poll(() =>
        value(`
          select status::text from public.daily_closes
          where hotel_id = '${AURORA_ID}' and business_date = '${date}';
        `),
      )
      .toBe("prepared");
  });

  await test.step("Erros propositais: quem prepara não aprova; ID de outro hotel falha", async () => {
    await expect
      .soft(page.getByRole("button", { name: "Aprovar e fechar" }))
      .toHaveCount(0);
    const foreign = await page.request.get(
      `/api/maintenance/occurrences/${HORIZON_OCCURRENCE}`,
    );
    expect.soft(foreign.status()).toBeGreaterThanOrEqual(400);
    expect.soft(foreign.status()).toBeLessThan(500);
  });

  await test.step("7b. Gerente revisa os indicadores, aprova o fechamento e confere pendências", async () => {
    await switchTo(page, MANAGER, "/dashboard/reservations/analytics");
    await expect.soft(page.getByRole("heading").first()).toBeVisible();
    await page.goto(`/dashboard/cash?date=${date}`);
    await page.getByRole("button", { name: "Aprovar e fechar" }).click();
    await expect
      .poll(() =>
        value(`
          select status::text from public.daily_closes
          where hotel_id = '${AURORA_ID}' and business_date = '${date}';
        `),
      )
      .toBe("closed");

    await page.goto("/dashboard/pending");
    await page.getByRole("button", { name: "Atualizar pendências" }).click();
    await expect(
      page.getByRole("button", { name: "Atualizar pendências" }),
    ).toBeEnabled();
    const left = () =>
      value(`
        select coalesce(string_agg(kind, ',' order by kind), '')
        from public.operational_pending
        where hotel_id = '${AURORA_ID}' and status <> 'resolved'
          and kind in ('governance_maintenance','warranty_expiry');
      `);
    await expect
      .poll(left, { message: "as pendências da origem foram encerradas" })
      .toBe("");
  });

  await test.step("8. Horizonte não vê nenhum dado do turno", async () => {
    await switchTo(page, HORIZON, "/dashboard/pending");
    await expect
      .soft(page.getByRole("heading", { name: "Garantia de equipamento" }))
      .toHaveCount(0);
    await expect
      .soft(page.getByText("Quarto 103: retido pela manutenção"))
      .toHaveCount(0);
    const order = await page.request.get(
      `/api/maintenance/occurrences/${OCCURRENCE_ID}`,
    );
    expect.soft(order.status()).toBeGreaterThanOrEqual(400);
    expect.soft(order.status()).toBeLessThan(500);
    await page.goto("/dashboard/procurement");
    await expect.soft(page.getByText("NF-0011")).toHaveCount(0);
  });

  await test.step("Erro proposital: avançar o relógio cria pendências sem corromper as anteriores", async () => {
    const closed = value(`
      select status::text || '|' || fingerprint from public.daily_closes
      where hotel_id = '${AURORA_ID}' and business_date = '${date}';
    `);
    advanceClock(1, "days");
    expect
      .soft(
        value(`
        select status::text || '|' || fingerprint from public.daily_closes
        where hotel_id = '${AURORA_ID}' and business_date = '${date}';
      `),
        "o dia fechado continua igual",
      )
      .toBe(closed);
  });

  await test.step("Verificação final: trilhas com atores distintos e invariantes", async () => {
    const actors = value(`
      select (c.prepared_by <> c.approved_by)
      from public.daily_closes c
      where c.hotel_id = '${AURORA_ID}' and c.business_date = '${date}';
    `);
    expect.soft(actors, "preparador e aprovador distintos").toBe("t");
    expect
      .soft(
        value(`
          select u.email from public.purchase_order_approvals a
          join public.users u on u.id = a.actor_id
          where a.purchase_order_id = '${ORDER_ID}';
        `),
      )
      .toBe(MANAGER);
    expect.soft(findInvariantViolations()).toEqual([]);
  });
});
