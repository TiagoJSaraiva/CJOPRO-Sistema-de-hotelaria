import { randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";
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

// Fonte das expectativas: docs/training/lesson-09-cash-close.md
const AURORA_ID = "10000000-0000-4000-8000-000000000001";
const BACKEND_URL = `http://127.0.0.1:${process.env.JOURNEY_BACKEND_PORT || 4102}`;
const CASHIER = "caixa.aurora@hotelaria.local";
const FINANCE = "financeiro.aurora@hotelaria.local";
const MANAGER = "gerente.aurora@hotelaria.local";

function operationalDate(): string {
  return queryLocal(
    `select public.hotel_operational_date('${AURORA_ID}')::text;`,
  );
}

function registerCard(page: Page) {
  return page.getByRole("article").filter({ hasText: "REC-01" });
}

async function switchTo(page: Page, email: string) {
  await signOut(page);
  await signIn(page, email);
  await page.goto("/dashboard/cash");
}

async function api(
  page: Page,
  context: BrowserContext,
  method: "get" | "post",
  path: string,
  data?: unknown,
) {
  const session = (await context.cookies()).find(
    (cookie) => cookie.name === "pms_session_token",
  );
  return page.request[method](`${BACKEND_URL}/admin/${path}`, {
    headers: { authorization: `Bearer ${session?.value}` },
    ...(data === undefined ? {} : { data }),
  });
}

function closeSnapshot(date: string): string {
  return queryLocal(`
    select status::text from public.daily_closes
    where hotel_id = '${AURORA_ID}' and business_date = '${date}';
  `);
}

async function openSession(page: Page, amount: string) {
  const card = registerCard(page);
  await card.getByLabel("Fundo inicial").fill(amount);
  await card.getByRole("button", { name: "Abrir sessão" }).click();
  await expect(registerCard(page)).toContainText("Sessão aberta");
}

async function count(page: Page, amount: string) {
  const card = registerCard(page);
  await card.getByLabel("Valor contado").fill(amount);
  await card.getByRole("button", { name: "Enviar contagem cega" }).click();
}

test("lição 9: sessão, contagem cega e fechamento diário", async ({
  page,
  context,
}) => {
  await prepareScenario("cash-close");
  const date = operationalDate();
  let sessionId = "";

  await test.step("1. Como caixa, abrir sessão no REC-01 com fundo de R$ 100", async () => {
    await signIn(page, CASHIER);
    await page.goto("/dashboard/cash");
    const card = registerCard(page);
    await expect.soft(card).toContainText("Caixa da recepção");
    await expect.soft(card).toContainText(/tolerância\s*R\$\s*5,00/);
    await openSession(page, "100");
    await expect.soft(card).toContainText(/Fundo inicial:\s*R\$\s*100,00/);
    sessionId = queryLocal(`
      select s.id from public.cash_sessions s
      join public.cash_registers r on r.id = s.cash_register_id
      where r.code = 'REC-01' and s.status = 'open';
    `);
    expect(sessionId).not.toBe("");
  });

  await test.step("2. Registrar entrada e saída justificadas e conferir por espécie", async () => {
    const card = registerCard(page);
    await card.getByLabel("Tipo de movimento").selectOption("cash_in");
    await card.getByLabel("Valor do movimento").fill("50");
    await card.getByLabel("Motivo do movimento").fill("Troco da gerência");
    await card.getByRole("button", { name: "Registrar" }).click();
    await expect(registerCard(page)).toContainText(/Suprimento:\s*R\$\s*50,00/);

    await registerCard(page)
      .getByLabel("Tipo de movimento")
      .selectOption("cash_out");
    await registerCard(page).getByLabel("Valor do movimento").fill("20");
    await registerCard(page)
      .getByLabel("Motivo do movimento")
      .fill("Compra de material");
    await registerCard(page).getByRole("button", { name: "Registrar" }).click();
    await expect(registerCard(page)).toContainText(/Retirada:\s*-?R\$\s*20,00/);

    // A tela é lida por pessoas: nenhum código interno.
    await expect.soft(registerCard(page)).not.toContainText("cash in");
    await expect.soft(registerCard(page)).not.toContainText("cash out");
  });

  await test.step("3. A contagem é cega: o esperado não vem nem na resposta", async () => {
    await expect
      .soft(registerCard(page))
      .toContainText("valor esperado protegido até a contagem");
    await expect.soft(registerCard(page)).not.toContainText("130,00");
    await expect.soft(page.locator("#daily-close")).not.toContainText("130,00");

    const response = await api(page, context, "get", "cash-registers");
    expect(response.status()).toBe(200);
    const body = await response.text();
    const register = (
      JSON.parse(body) as {
        registers: Array<{
          code: string;
          active_session: { expected_cash: number | null } | null;
        }>;
      }
    ).registers.find((item) => item.code === "REC-01");
    expect.soft(register?.active_session?.expected_cash).toBeNull();

    const single = await api(
      page,
      context,
      "get",
      `cash-sessions/${sessionId}`,
    );
    expect.soft(single.status()).toBe(200);
    const detail = (await single.json()) as { expected_cash?: number | null };
    expect.soft(detail.expected_cash ?? null).toBeNull();
  });

  await test.step("Erro proposital: preparar o dia com a sessão aberta", async () => {
    await switchTo(page, FINANCE);
    await expect
      .soft(page.getByText("Feche ou cancele a sessão de caixa").first())
      .toBeVisible();
    const button = page.getByRole("button", { name: "Preparar fechamento" });
    await button.click();
    await expect
      .soft(page.getByRole("alert").or(page.getByRole("status")).first())
      .toBeVisible();
    expect
      .soft(closeSnapshot(date), "o dia não fica preparado")
      .not.toBe("prepared");
    await switchTo(page, CASHIER);
  });

  await test.step("4. Informar o contado e só então comparar", async () => {
    await count(page, "120");
    const card = registerCard(page);
    await expect.soft(card).toContainText("Sessão com diferença pendente");
    await expect.soft(card).not.toContainText("difference pending");
    await expect.soft(card).toContainText(/Contado:\s*R\$\s*120,00/);
    await expect.soft(card).toContainText(/-\s*R\$\s*10,00/);
    await expect.soft(card).toContainText(/esperado\s*R\$\s*130,00/);
    const stored = queryLocal(`
      select status || '|' || expected_cash::numeric(12,2) || '|' ||
        counted_cash::numeric(12,2) || '|' || difference_amount::numeric(12,2)
      from public.cash_sessions where id = '${sessionId}';
    `);
    expect.soft(stored).toBe("difference_pending|130.00|120.00|-10.00");
  });

  await test.step("Erro proposital: o caixa não aprova a própria diferença", async () => {
    await expect
      .soft(registerCard(page).getByRole("button", { name: "Aprovar" }))
      .toHaveCount(0);
    const version = queryLocal(
      `select version from public.cash_sessions where id = '${sessionId}';`,
    );
    const refused = await api(
      page,
      context,
      "post",
      `cash-sessions/${sessionId}/actions`,
      {
        action: "approve_difference",
        expected_version: Number(version),
        reason: "Aprovando a própria diferença",
        idempotency_key: randomUUID(),
      },
    );
    expect.soft(refused.status()).toBe(403);
  });

  await test.step("5. Como financeiro, aprovar a diferença", async () => {
    await switchTo(page, FINANCE);
    const card = registerCard(page);
    await card.getByPlaceholder("Justificativa").fill("Diferença conferida");
    await card.getByRole("button", { name: "Aprovar" }).click();
    await expect
      .poll(() =>
        queryLocal(
          `select status from public.cash_sessions where id = '${sessionId}';`,
        ),
      )
      .toBe("closed");
    const sessions = page.getByTestId("daily-cash-sessions");
    await expect.soft(sessions).toContainText(/Esperado:\s*R\$\s*130,00/);
    await expect.soft(sessions).toContainText(/Contado:\s*R\$\s*120,00/);
    await expect.soft(sessions).toContainText("Encerrada");
    await expect.soft(sessions).not.toContainText("closed");
  });

  await test.step("6. Como financeiro, preparar o fechamento da data", async () => {
    await page.goto(`/dashboard/cash?date=${date}`);
    await page.getByRole("button", { name: "Preparar fechamento" }).click();
    await expect.poll(() => closeSnapshot(date)).toBe("prepared");
    const daily = page.locator("#daily-close");
    await expect.soft(daily).toContainText("Preparado");
    await expect.soft(daily).not.toContainText("prepared");
    await expect.soft(daily).toContainText("preparado por");
  });

  await test.step("Erro proposital: quem preparou não aprova", async () => {
    await expect
      .soft(page.getByRole("button", { name: "Aprovar e fechar" }))
      .toHaveCount(0);
    const close = queryLocal(`
      select version || '|' || fingerprint from public.daily_closes
      where hotel_id = '${AURORA_ID}' and business_date = '${date}';
    `);
    const [version, fingerprint] = close.split("|");
    const refused = await api(
      page,
      context,
      "post",
      `daily-close/${date}/actions`,
      {
        action: "approve",
        expected_version: Number(version),
        expected_fingerprint: fingerprint,
        reason: "Aprovando a própria preparação",
      },
    );
    expect.soft(refused.status()).toBe(403);
    expect.soft(closeSnapshot(date)).toBe("prepared");
  });

  await test.step("Erro proposital: aprovar depois de a projeção mudar", async () => {
    await switchTo(page, CASHIER);
    await expect
      .soft(registerCard(page))
      .toContainText(/Última contagem:\s*R\$\s*120,00/);
    await expect
      .soft(registerCard(page).getByLabel("Fundo inicial"))
      .toHaveValue("120");
    const refusedOpening = registerCard(page);
    await refusedOpening.getByLabel("Fundo inicial").fill("10");
    await refusedOpening.getByRole("button", { name: "Abrir sessão" }).click();
    await expect
      .soft(page.getByRole("alert").first())
      .toContainText("difere da última contagem");
    await registerCard(page)
      .getByLabel("Justificativa, se o valor mudar")
      .fill("Retirada para a tesouraria antes do turno");
    await openSession(page, "10");
    await count(page, "10");
    await expect
      .poll(() =>
        queryLocal(`
          select count(*) from public.cash_sessions s
          join public.cash_registers r on r.id = s.cash_register_id
          where r.code = 'REC-01' and s.status = 'closed';
        `),
      )
      .toBe("2");

    await switchTo(page, MANAGER);
    await page.goto(`/dashboard/cash?date=${date}`);
    await page.getByRole("button", { name: "Aprovar e fechar" }).click();
    await expect
      .soft(page.getByRole("alert").or(page.getByRole("status")).first())
      .toBeVisible();
    expect
      .soft(closeSnapshot(date), "a aprovação antiga não fecha o dia")
      .not.toBe("closed");
  });

  await test.step("6. Preparar de novo e, como gerente, aprovar", async () => {
    // Com a projeção antiga, a preparação precisa ser refeita.
    if (closeSnapshot(date) === "prepared") {
      await page.goto(`/dashboard/cash?date=${date}`);
      await page
        .getByLabel("Observação (obrigatória ao devolver)")
        .fill("Sessão nova depois da preparação");
      await page.getByRole("button", { name: "Devolver" }).click();
      await expect.poll(() => closeSnapshot(date)).not.toBe("prepared");
    }
    await switchTo(page, FINANCE);
    await page.goto(`/dashboard/cash?date=${date}`);
    await page.getByRole("button", { name: "Preparar fechamento" }).click();
    await expect.poll(() => closeSnapshot(date)).toBe("prepared");

    await switchTo(page, MANAGER);
    await page.goto(`/dashboard/cash?date=${date}`);
    await page.getByRole("button", { name: "Aprovar e fechar" }).click();
    await expect.poll(() => closeSnapshot(date)).toBe("closed");
    const stored = queryLocal(`
      select (prepared_by <> approved_by) || '|' || (fingerprint is not null)
        || '|' || (snapshot is not null)
      from public.daily_closes
      where hotel_id = '${AURORA_ID}' and business_date = '${date}';
    `);
    expect
      .soft(stored, "preparador e aprovador distintos")
      .toBe("true|true|true");
    await expect.soft(page.locator("#daily-close")).toContainText("Fechado");
  });

  await test.step("7. Dia seguinte, sem movimentos: fechar com Dia sem movimentação", async () => {
    advanceClock(1, "days");
    const next = operationalDate();
    expect(next).not.toBe(date);

    await switchTo(page, FINANCE);
    await page.goto(`/dashboard/cash?date=${next}`);
    await expect.soft(page.getByText("Dia sem movimentação")).toBeVisible();
    await page.getByRole("button", { name: "Preparar fechamento" }).click();
    await expect.poll(() => closeSnapshot(next)).toBe("prepared");

    await switchTo(page, MANAGER);
    await page.goto(`/dashboard/cash?date=${next}`);
    await page.getByRole("button", { name: "Aprovar e fechar" }).click();
    await expect.poll(() => closeSnapshot(next)).toBe("closed");
  });

  await test.step("Banco: movimentos e contagens são históricos", async () => {
    const movements = queryLocal(`
      select count(*) filter (where kind = 'cash_in') || '|' ||
        count(*) filter (where kind = 'cash_out')
      from public.cash_movements where cash_session_id = '${sessionId}';
    `);
    expect.soft(movements).toBe("1|1");
  });

  await test.step("Invariantes de negócio ao final da jornada", async () => {
    expect.soft(findInvariantViolations()).toEqual([]);
  });
});
