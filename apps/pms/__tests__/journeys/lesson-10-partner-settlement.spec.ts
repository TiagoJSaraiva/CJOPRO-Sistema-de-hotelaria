import type { BrowserContext, Page } from "@playwright/test";
import {
  expect,
  findInvariantViolations,
  prepareScenario,
  queryLocal,
  signIn,
  signOut,
  test,
} from "./support";

// Fonte das expectativas: docs/training/lesson-10-partner-settlement.md e
// docs/consumption-management.md. O cenário vende R$ 200,00 pelo hotel, com comissão
// de 20%: a comissão é R$ 40,00, e o hotel repassa R$ 160,00 ao parceiro.
const AURORA_ID = "10000000-0000-4000-8000-000000000001";
const PARTNER_ID = "a3010000-0000-4000-8000-000000000001";
const BACKEND_URL = `http://127.0.0.1:${process.env.JOURNEY_BACKEND_PORT || 4102}`;
const FINANCE = "financeiro.aurora@hotelaria.local";
const MANAGER = "gerente.aurora@hotelaria.local";
const SETTLEMENTS = "/dashboard/consumption/settlements";

function settlementRow(): string {
  return queryLocal(`
    select id || '|' || status || '|' || version || '|' || payment_state || '|' || dispute_state
    from public.partner_settlements
    where hotel_id = '${AURORA_ID}' and partner_id = '${PARTNER_ID}';
  `);
}

function settlementField(index: number): string {
  return settlementRow().split("|")[index] ?? "";
}

async function switchTo(page: Page, email: string, path: string) {
  await signOut(page);
  await signIn(page, email);
  await page.goto(path);
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

function confirmDialogs(page: Page) {
  page.on("dialog", (dialog) => void dialog.accept());
}

test("lição 10: apuração, contestação e liquidação", async ({
  page,
  context,
  diagnostics,
}) => {
  test.setTimeout(240_000);
  await prepareScenario("partner-settlement");
  await signIn(page, MANAGER);
  confirmDialogs(page);
  // Os erros propositais respondem 403, 409 ou 422 de propósito.
  diagnostics.allow(/Failed to load resource/);

  await test.step("1. Conferir acordo e revisão vigente", async () => {
    await page.goto("/dashboard/consumption/agreements");
    await expect(page.getByText("AUR-PAR-001").first()).toBeVisible();
  });

  await switchTo(page, FINANCE, SETTLEMENTS);

  await test.step("2. O candidato do mês encerrado aparece sem apuração", async () => {
    const candidates = page.locator(
      '[data-usage-guide="settlement-candidates"]',
    );
    await expect(candidates).toContainText("Sabores Escola");
    await expect(candidates).toContainText("Ainda não gerada");
  });

  await test.step("3. Preparar: venda, comissão e saldo batem com o cenário", async () => {
    await page.getByRole("button", { name: "Gerar apuração" }).click();
    const statement = page.locator('[data-usage-guide="settlement-statement"]');
    await expect(statement).toContainText("Rascunho");
    await expect(statement).toContainText("Repasse ao parceiro");
    await expect(statement).toContainText("R$ 160,00");
    await expect(
      statement.locator("div").filter({ hasText: /^Comissão/ }),
    ).toContainText("R$ 40,00");
    await expect(
      statement.locator("div").filter({ hasText: /^Venda líquida/ }),
    ).toContainText("R$ 200,00");
  });

  await test.step("Recalcular substitui o rascunho e incrementa a versão", async () => {
    const before = Number(settlementField(2));
    await page.getByRole("button", { name: "Recalcular" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Apuração recalculada",
    );
    expect(Number(settlementField(2))).toBe(before + 1);
  });

  await test.step("Enviar para revisão", async () => {
    await expect(
      page.getByRole("button", { name: "Enviar para revisão" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Enviar para revisão" }).click();
    await expect(
      page.locator('[data-usage-guide="settlement-statement"]'),
    ).toContainText("Em revisão");
  });

  const settlementId = settlementField(0);
  const detail = `${SETTLEMENTS}?id=${settlementId}`;

  await test.step("Erro proposital: quem prepara não aprova", async () => {
    await expect(page.getByRole("button", { name: "Aprovar" })).toHaveCount(0);
    const response = await api(
      page,
      context,
      `partner-settlements/${settlementId}/decision`,
      { decision: "approve", expected_version: Number(settlementField(2)) },
    );
    expect(response.status()).toBe(403);
    expect(settlementField(1)).toBe("in_review");
  });

  await switchTo(page, MANAGER, detail);

  await test.step("Erro proposital: versão antiga é recusada e nada muda", async () => {
    const version = Number(settlementField(2));
    const response = await api(
      page,
      context,
      `partner-settlements/${settlementId}/decision`,
      { decision: "approve", expected_version: version - 1 },
    );
    expect(response.status()).toBe(409);
    expect(settlementField(1)).toBe("in_review");
    expect(Number(settlementField(2))).toBe(version);
  });

  await test.step("Falha aparece como falha, não como sucesso", async () => {
    await page.goto(
      `${SETTLEMENTS}?id=${settlementId}&status=settlement_version_conflict`,
    );
    await expect(page.locator("p[role=alert]")).toContainText(
      "A apuração mudou",
    );
  });

  await test.step("Rejeitar rejeita: a apuração volta ao rascunho, sem aprovar", async () => {
    await page.goto(detail);
    await page
      .getByLabel("Motivo da rejeição (obrigatório ao rejeitar)")
      .fill("Conferir a fonte da venda");
    await page.getByRole("button", { name: "Rejeitar" }).click();
    await expect(page.getByRole("status")).toContainText("Apuração rejeitada");
    expect(settlementField(1)).toBe("draft");
  });

  await switchTo(page, FINANCE, detail);

  await test.step("Depois da rejeição, o financeiro envia de novo", async () => {
    await page.getByRole("button", { name: "Enviar para revisão" }).click();
    await expect(
      page.locator('[data-usage-guide="settlement-statement"]'),
    ).toContainText("Em revisão");
  });

  await switchTo(page, MANAGER, detail);

  await test.step("4. O gerente aprova, e a versão fica imutável", async () => {
    await page.goto(detail);
    await page.getByRole("button", { name: "Aprovar" }).click();
    const statement = page.locator('[data-usage-guide="settlement-statement"]');
    await expect(statement).toContainText("Aprovada");
    await expect(page.getByRole("button", { name: "Recalcular" })).toHaveCount(
      0,
    );
    await expect(statement.getByText(/\bapproved\b|\bin_review\b/)).toHaveCount(
      0,
    );
  });

  await switchTo(page, FINANCE, detail);

  await test.step("5. Financeiro contesta uma parte do componente", async () => {
    await page.getByLabel("Valor contestado").fill("10");
    await page
      .getByLabel("Motivo", { exact: true })
      .fill("Nota da venda não confere com o pedido");
    await page.getByRole("button", { name: "Abrir contestação" }).click();
    const disputes = page.locator('[data-usage-guide="settlement-disputes"]');
    await expect(disputes).toContainText("Nota da venda não confere");
    // A situação da contestação aparece em português.
    await expect(disputes.locator("article strong")).toContainText("Aberta");
    expect(settlementField(4)).toBe("disputed");
  });

  await test.step("Quem abre a contestação não a decide", async () => {
    const [disputeId, version] = queryLocal(`
      select id || '|' || version from public.partner_settlement_disputes
      where hotel_id = '${AURORA_ID}' and settlement_id = '${settlementId}';
    `).split("|");
    const response = await api(
      page,
      context,
      `consumption/partner-disputes/${disputeId}/actions`,
      {
        action: "accept",
        expected_version: Number(version),
        reason: "Decisão da própria pessoa que contestou",
      },
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(
      queryLocal(`
        select status from public.partner_settlement_disputes
        where id = '${disputeId}';
      `),
    ).toBe("open");
  });

  await test.step("O saldo não contestado continua liquidável, mas o contestado não", async () => {
    const form = page.locator("form").filter({
      has: page.getByRole("button", { name: "Registrar baixa" }),
    });
    await form.getByLabel("Valor desta baixa").fill("155");
    await form.getByRole("button", { name: "Registrar baixa" }).click();
    await expect(page.locator("p[role=alert]")).toContainText(
      "passa do saldo liquidável",
    );
    expect(
      queryLocal(`
        select count(*) from public.partner_settlement_payments
        where hotel_id = '${AURORA_ID}' and settlement_id = '${settlementId}';
      `),
    ).toBe("0");

    await page.goto(detail);
    await form.getByLabel("Valor desta baixa").fill("50");
    await form.getByRole("button", { name: "Registrar baixa" }).click();
    await expect(page.getByRole("status")).toContainText("Baixa registrada");
    await expect(
      page.locator('[data-usage-guide="settlement-statement"]'),
    ).toContainText("Parcialmente liquidada");
    expect(settlementField(3)).toBe("partially_settled");
  });

  await switchTo(page, MANAGER, detail);

  await test.step("6. O gerente aceita a contestação", async () => {
    const disputes = page.locator('[data-usage-guide="settlement-disputes"]');
    await disputes
      .getByPlaceholder("Fundamento da decisão")
      .fill("Pedido confere com a nota corrigida");
    await disputes.getByRole("button", { name: "Aceitar" }).click();
    await expect(disputes.locator("article strong")).toContainText("Aceita");
    expect(settlementField(4)).toBe("resolved");
  });

  await switchTo(page, FINANCE, detail);

  await test.step("A contestação aceita fica fora do saldo; o restante liquida", async () => {
    const form = page.locator("form").filter({
      has: page.getByRole("button", { name: "Registrar baixa" }),
    });
    // 160 - 10 aceitos - 50 pagos = 100.
    await form.getByLabel("Valor desta baixa").fill("110");
    await form.getByRole("button", { name: "Registrar baixa" }).click();
    await expect(page.locator("p[role=alert]")).toContainText(
      "passa do saldo liquidável",
    );
    await page.goto(detail);
    await form.getByLabel("Valor desta baixa").fill("100");
    await form.getByRole("button", { name: "Registrar baixa" }).click();
    await expect(page.getByRole("status")).toContainText("Baixa registrada");
    expect(settlementField(3)).toBe("settled");
  });

  await test.step("Verificação final: a trilha e os indicadores contam a história", async () => {
    await page.goto(detail);
    await page.getByText("Linha do tempo").click();
    const trail = page.locator("details").filter({ hasText: "Linha do tempo" });
    await expect(trail).toContainText("Financeiro Aurora");
    await expect(trail).toContainText("Gerente Aurora");
    // As ações da trilha aparecem em português.
    await expect(
      trail.getByText(/\b(dispute_accept|approved|submitted)\b/),
    ).toHaveCount(0);

    await switchTo(page, MANAGER, detail);
    const [from, to] = queryLocal(`
      select period_start || '|' || period_end from public.partner_settlements
      where id = '${settlementId}';
    `).split("|");
    await page.goto(
      `/dashboard/consumption/analytics?from=${from}&to=${to}&dimension=partner`,
    );
    await expect(page.getByRole("main")).toContainText("Sabores Escola");
  });

  await test.step("Banco: a revisão comercial não foi reescrita e o cálculo guarda a regra", async () => {
    expect(
      queryLocal(`
        select commission_percentage::numeric(5,2)::text
        from public.commercial_agreement_revisions
        where id = 'a3040000-0000-4000-8000-000000000001';
      `),
    ).toBe("20.00");
    expect(
      Number(
        queryLocal(`
          select count(*) from public.partner_settlement_events
          where settlement_id = '${settlementId}';
        `),
      ),
    ).toBeGreaterThanOrEqual(5);
  });

  await test.step("Invariantes de negócio ao final da jornada", async () => {
    expect(findInvariantViolations()).toEqual([]);
  });
});
