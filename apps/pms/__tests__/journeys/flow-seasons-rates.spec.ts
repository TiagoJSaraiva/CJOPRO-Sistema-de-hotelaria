import type { Page } from "@playwright/test";
import {
  expect,
  findInvariantViolations,
  prepareScenario,
  queryLocal,
  signIn,
  test,
} from "./support";

// Fonte das expectativas: docs/qa/rules-flows.md (TAR-01 a TAR-06). Dados sintéticos.
// Só o gerente do Hotel Horizonte mantém temporadas nas contas didáticas (QA-085).
const HORIZON_ID = "10000000-0000-4000-8000-000000000002";
const ROOM_QUERY = `select id from public.rooms where hotel_id = '${HORIZON_ID}' order by room_number limit 1;`;
const ROOM_TYPE_QUERY = `select room_type from public.rooms where hotel_id = '${HORIZON_ID}' order by room_number limit 1;`;
const CUSTOMER_QUERY = `select id from public.customers where hotel_id = '${HORIZON_ID}' limit 1;`;

function operationalDatePlus(days: number): string {
  return queryLocal(
    `select public.hotel_operational_date('${HORIZON_ID}') + ${days};`,
  );
}

async function dailyRate(page: Page, date: string) {
  const response = await page.request.post(
    "/api/reservations-calendar/simulate",
    {
      data: {
        booking_customer: {
          mode: "existing",
          customer_id: queryLocal(CUSTOMER_QUERY),
        },
        selected_cells: [
          { room_id: queryLocal(ROOM_QUERY), date, side: "full" },
        ],
        reservation_source: null,
        notes: null,
      },
    },
  );
  expect(response.ok()).toBe(true);
  const item = (await response.json()) as {
    breakdown: Array<{
      base_daily_rate: number;
      season_extra_rate: number;
      final_daily_rate: number;
    }>;
  };
  return item.breakdown[0]!;
}

test("temporada ativa muda o preço só no período, e inativa não muda", async ({
  page,
}) => {
  test.setTimeout(420_000);
  await prepareScenario("orientation");
  const start = operationalDatePlus(200);
  const end = operationalDatePlus(203);
  const name = "Alta de roteiro";

  await signIn(page, "gerente.horizonte@hotelaria.local");

  await test.step("Sem temporada vale a diária-base", async () => {
    const outside = await dailyRate(page, start);
    expect(outside.season_extra_rate).toBe(0);
  });

  await test.step("Criar temporada e adicional", async () => {
    await page.goto("/dashboard/seasons/create");
    await page.getByLabel("Nome").fill(name);
    await page.getByLabel("Data inicial").fill(start);
    await page.getByLabel("Data final").fill(end);
    await page.getByRole("button", { name: "Criar temporada" }).click();
    await expect(page).toHaveURL(/status=/);
    await page.goto("/dashboard/season-room-rates/create");
    const seasonId = queryLocal(
      `select id from public.seasons where hotel_id = '${HORIZON_ID}' and name = '${name}';`,
    );
    await page.getByLabel("Temporada").selectOption(seasonId);
    await page.getByLabel("Tipo de quarto").fill(queryLocal(ROOM_TYPE_QUERY));
    await page.getByLabel("Taxa diária").fill("50");
    await page.getByRole("button", { name: "Criar tarifa" }).click();
    await expect(page).toHaveURL(/status=/);
    expect(
      queryLocal(`
        select r.daily_rate::numeric(12,2) from public.season_room_rates r
        join public.seasons s on s.id = r.season_id
        where s.hotel_id = '${HORIZON_ID}' and s.name = '${name}';
      `),
    ).toBe("50.00");
  });

  await test.step("O adicional vale do primeiro ao último dia", async () => {
    for (const date of [start, end]) {
      const rate = await dailyRate(page, date);
      expect(rate.season_extra_rate, date).toBe(50);
      expect(rate.final_daily_rate, date).toBe(rate.base_daily_rate + 50);
    }
    const after = await dailyRate(page, operationalDatePlus(204));
    expect(after.season_extra_rate, "o dia seguinte não tem adicional").toBe(0);
  });

  await test.step("Temporada sobreposta é recusada", async () => {
    await page.goto("/dashboard/seasons/create");
    await page.getByLabel("Nome").fill("Sobreposta de roteiro");
    await page.getByLabel("Data inicial").fill(end);
    await page.getByLabel("Data final").fill(operationalDatePlus(210));
    await page.getByRole("button", { name: "Criar temporada" }).click();
    await expect(
      page.getByText("Já existe temporada ativa nesse período.", {
        exact: false,
      }),
    ).toBeVisible();
    expect(
      queryLocal(
        `select count(*) from public.seasons where hotel_id = '${HORIZON_ID}' and name = 'Sobreposta de roteiro';`,
      ),
    ).toBe("0");
  });

  await test.step("Desativar a temporada tira o adicional", async () => {
    const id = queryLocal(
      `select id from public.seasons where hotel_id = '${HORIZON_ID}' and name = '${name}';`,
    );
    await page.goto(`/dashboard/seasons/view?seasonId=${id}&mode=edit`);
    await page.getByLabel("Temporada ativa").uncheck();
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page).toHaveURL(/status=/);
    expect(
      queryLocal(`select is_active from public.seasons where id = '${id}';`),
    ).toBe("f");
    const rate = await dailyRate(page, start);
    expect(rate.season_extra_rate).toBe(0);
  });

  expect(findInvariantViolations()).toEqual([]);
});

test("planos tarifários só consultam e mostram a política", async ({
  page,
}) => {
  await prepareScenario("reservations-arrival");
  await signIn(page, "gerente.aurora@hotelaria.local");
  await page.goto("/dashboard/reservations/rates");
  await expect(
    page.getByRole("heading", { name: "Planos cadastrados" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar plano" })).toHaveCount(
    0,
  );
  const plan = page.locator("article").filter({ hasText: "LESSON-02" });
  await expect(plan).toContainText("Tarifa flexível · Ativo · versão 1");
  await expect(plan).toContainText("Cancelamento e no-show sem multa.");
});
