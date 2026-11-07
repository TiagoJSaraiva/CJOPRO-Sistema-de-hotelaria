import {
  expect,
  findInvariantViolations,
  prepareScenario,
  queryLocal,
  signIn,
  signOut,
  test,
} from "./support";

// Fonte das expectativas: docs/qa/rules-flows.md (MAN-01 a MAN-05). As regras de prazo e competência são
// provadas em maintenance_planning_flows.test.sql; aqui fica o caminho pela tela e as permissões.
const AURORA_ID = "10000000-0000-4000-8000-000000000001";
const SUPERVISOR = "supervisor.manutencao.aurora@hotelaria.local";

test("supervisor cria e conduz um plano preventivo", async ({ page }) => {
  test.setTimeout(300_000);
  await prepareScenario("governance-maintenance");
  await signIn(page, SUPERVISOR);
  await page.goto("/dashboard/maintenance/preventive");
  const name = "Revisão do roteiro";
  const status = () =>
    queryLocal(`
      select status from public.maintenance_preventive_plans
      where hotel_id = '${AURORA_ID}' and name = '${name}';
    `);

  await test.step("Criar o plano", async () => {
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="category_id"]').selectOption({ index: 1 });
    await page.locator('select[name="target"]').selectOption({ index: 1 });
    await page.locator('select[name="assigned_to"]').selectOption({ index: 1 });
    await page
      .locator('textarea[name="instructions"]')
      .fill("Revisar o quarto");
    await page.locator('textarea[name="tasks"]').fill("Conferir tomadas");
    await page.getByRole("button", { name: "Criar plano" }).click();
    await expect.poll(status).toBe("active");
    const tasks = queryLocal(`
      select count(*) from public.maintenance_preventive_plan_tasks t
      join public.maintenance_preventive_plans p on p.id = t.plan_id
      where p.name = '${name}';
    `);
    expect(tasks).toBe("1");
  });

  const card = page.locator("article, li").filter({ hasText: name }).first();
  await test.step("Mostra situação e prioridade em português", async () => {
    await expect(card).toBeVisible();
    await expect(card).not.toContainText(/\bactive\b|\bnormal\b/);
  });

  await test.step("Pausar, retomar e desativar", async () => {
    await card.getByRole("button", { name: "Pausar" }).click();
    await expect.poll(status).toBe("paused");
    await page
      .locator("article, li")
      .filter({ hasText: name })
      .first()
      .getByRole("button", { name: "Retomar" })
      .click();
    await expect.poll(status).toBe("active");
    await page
      .locator("article, li")
      .filter({ hasText: name })
      .first()
      .getByRole("button", { name: "Desativar" })
      .click();
    await expect.poll(status).toBe("inactive");
  });

  await test.step("O técnico consulta, mas não gerencia", async () => {
    await signOut(page);
    await signIn(page, "tecnico.aurora@hotelaria.local");
    await page.goto("/dashboard/maintenance/preventive");
    await expect(page.getByRole("button", { name: "Criar plano" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Desativar" })).toHaveCount(
      0,
    );
  });

  expect(findInvariantViolations()).toEqual([]);
});

test("supervisor cria política de SLA, e a recepção não acessa", async ({
  page,
  diagnostics,
}) => {
  diagnostics.allow(/status of 40[09]/);
  test.setTimeout(300_000);
  await prepareScenario("governance-maintenance");
  await signIn(page, SUPERVISOR);
  await page.goto("/dashboard/maintenance/sla");
  const name = "SLA do roteiro";

  await test.step("Criar a política", async () => {
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="category_id"]').selectOption({ index: 1 });
    await page.locator('select[name="priority"]').selectOption("high");
    await page.locator('input[name="response_hours"]').fill("2");
    await page.locator('input[name="resolution_hours"]').fill("10");
    await page.getByRole("button", { name: "Criar política" }).click();
    await expect
      .poll(() =>
        queryLocal(`
          select response_hours || '|' || resolution_hours || '|' || is_active
          from public.maintenance_sla_policies
          where hotel_id = '${AURORA_ID}' and name = '${name}';
        `),
      )
      .toBe("2|10|true");
    await expect(page.getByText(name).first()).toBeVisible();
  });

  await test.step("Resolução menor que a resposta é recusada", async () => {
    // A categoria evita a recusa por duplicidade: a prioridade baixa já tem política geral.
    await page.locator('input[name="name"]').fill("SLA invertido");
    await page.locator('select[name="category_id"]').selectOption({ index: 1 });
    await page.locator('select[name="priority"]').selectOption("low");
    await page.locator('input[name="response_hours"]').fill("10");
    await page.locator('input[name="resolution_hours"]').fill("2");
    await page.getByRole("button", { name: "Criar política" }).click();
    await expect(
      page.getByText(
        "O prazo de resolução não pode ser menor que o de resposta.",
      ),
    ).toBeVisible();
    expect(
      queryLocal(
        `select count(*) from public.maintenance_sla_policies where name = 'SLA invertido';`,
      ),
    ).toBe("0");
  });

  await test.step("Política repetida é recusada com o motivo", async () => {
    await page.locator('input[name="name"]').fill("SLA repetido");
    await page.locator('select[name="category_id"]').selectOption("");
    await page.locator('select[name="priority"]').selectOption("low");
    await page.locator('input[name="response_hours"]').fill("2");
    await page.locator('input[name="resolution_hours"]').fill("10");
    await page.getByRole("button", { name: "Criar política" }).click();
    await expect(
      page.getByText(
        "Já existe uma política ativa para esta prioridade e categoria.",
      ),
    ).toBeVisible();
    expect(
      queryLocal(
        `select count(*) from public.maintenance_sla_policies where name = 'SLA repetido';`,
      ),
    ).toBe("0");
  });

  await test.step("A recepção não acessa as políticas", async () => {
    await signOut(page);
    await signIn(page, "recepcao.aurora@hotelaria.local");
    await page.goto("/dashboard/maintenance/sla");
    await expect(
      page.getByText("Sem permissão para consultar políticas de SLA."),
    ).toBeVisible();
  });

  expect(findInvariantViolations()).toEqual([]);
});
