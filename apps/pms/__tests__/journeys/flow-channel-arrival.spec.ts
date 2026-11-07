import {
  expect,
  findInvariantViolations,
  prepareScenario,
  queryLocal,
  signIn,
  test,
} from "./support";

// Fonte das expectativas: docs/qa/rules-flows.md (RES-09 a RES-12). Canal fictício e dados sintéticos.
const AURORA_ID = "10000000-0000-4000-8000-000000000001";
const UNASSIGNED = "/dashboard/reservations/unassigned";
const CODE_QUERY = `
  select r.reservation_code from public.reservations r
  where r.hotel_id = '${AURORA_ID}' and r.reservation_source = 'agency'
    and r.booking_customer_id is null
  order by r.created_at desc limit 1;
`;

function operationalDatePlus(days: number): string {
  return queryLocal(
    `select public.hotel_operational_date('${AURORA_ID}') + ${days};`,
  );
}

test("reserva de canal chega ao calendário depois de identificada e alocada", async ({
  page,
}) => {
  test.setTimeout(420_000);
  await prepareScenario("channels");
  const header =
    "event_id,event_type,external_reservation_id,occurred_at,room_code,rate_code,checkin_date,checkout_date,adults,children,currency,total,guest_name,guest_email,guest_phone";

  await test.step("Conectar e mapear o canal", async () => {
    await signIn(page, "gerente.aurora@hotelaria.local");
    await page.goto("/dashboard/reservations/channels");
    await page
      .getByPlaceholder("HospedaLink Sandbox")
      .fill("HospedaLink Sandbox");
    await page.getByPlaceholder("HOSPEDALINK-AURORA").fill("AURORA-DEMO");
    await page.getByRole("button", { name: "Criar conexão" }).click();
    await expect(page.getByLabel("Segredo do canal")).toBeVisible();
    await page.goto("/dashboard/reservations/channels");
    await page.getByLabel("Código externo da categoria").fill("STD");
    await page.getByLabel("Categoria interna").selectOption({ index: 1 });
    await page.getByLabel("Código externo da tarifa").fill("FLEX");
    await page.getByLabel("Plano tarifário interno").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Salvar mapeamento" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Mapeamento salvo",
    );
  });

  await test.step("Importar a reserva pelo canal", async () => {
    await page
      .getByLabel("Conteúdo CSV")
      .fill(
        [
          header,
          [
            "FLOW-1",
            "create",
            "RES-FLOW-1",
            `${operationalDatePlus(0)}T12:00:00Z`,
            "STD",
            "FLEX",
            operationalDatePlus(20),
            operationalDatePlus(22),
            "2",
            "0",
            "BRL",
            "500",
            "Hóspede Exemplo",
            "guest@example.invalid",
            "+551100000000",
          ].join(","),
        ].join("\n"),
      );
    await page.getByRole("button", { name: "Importar para revisão" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Arquivo importado",
    );
  });

  await test.step("Aplicar o evento na caixa de entrada", async () => {
    const pending = page
      .locator('[data-usage-guide="channel-inbox"] article', {
        hasText: "RES-FLOW-1",
      })
      .first();
    await pending
      .getByPlaceholder("Motivo da decisão")
      .fill("Reserva do canal");
    await pending.getByRole("button", { name: "Registrar decisão" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Evento de canal atualizado",
    );
  });

  await expect.poll(() => queryLocal(CODE_QUERY)).toMatch(/^CH-/);
  const code = queryLocal(CODE_QUERY);

  await test.step("A reserva espera na fila, com o contato do canal", async () => {
    await page.goto(UNASSIGNED);
    const card = page.locator("article").filter({ hasText: code });
    await expect(card).toContainText("Canal de reserva");
    await expect(card).toContainText("Hóspede Exemplo");
    await expect(card).toContainText(
      "Identifique o hóspede para alocar o quarto.",
    );
    await expect(
      card.getByRole("button", { name: "Alocar quarto" }),
    ).toHaveCount(0);
    await expect(page.getByTestId("reservation-calendar-grid")).toHaveCount(0);
  });

  await test.step("Identificar o hóspede com documento", async () => {
    const card = page.locator("article").filter({ hasText: code });
    await card.getByText("Cadastrar novo cliente").click();
    await expect(card.getByLabel("Nome completo")).toHaveValue(
      "Hóspede Exemplo",
    );
    await card.getByLabel("Número do documento").fill("52998224725");
    await card.getByLabel("Data de nascimento").fill("1990-05-20");
    await card.getByRole("button", { name: "Cadastrar e vincular" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Hóspede identificado",
    );
    await expect(
      page.locator("article").filter({ hasText: code }),
    ).toContainText("Identificado: Hóspede Exemplo");
  });

  await test.step("Alocar o quarto cria a estadia e o pagador", async () => {
    const card = page.locator("article").filter({ hasText: code });
    await card.getByRole("button", { name: "Alocar quarto" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Quarto alocado",
    );
    await expect(page.locator("article").filter({ hasText: code })).toHaveCount(
      0,
    );
    const stay = queryLocal(`
      select s.stay_status || '|' || a.status || '|' || p.display_name
      from public.reservations r
      join public.reservation_accommodations a on a.reservation_id = r.id
      join public.stays s on s.id = a.stay_id
      join public.stay_payer_accounts p on p.stay_id = s.id and p.kind = 'primary_guest'
      where r.reservation_code = '${code}';
    `);
    expect(stay).toBe("confirmed|assigned|Hóspede Exemplo");
  });

  expect(findInvariantViolations()).toEqual([]);
});

test("quem não aloca quartos não vê a fila", async ({ page }) => {
  await prepareScenario("channels");
  await signIn(page, "financeiro.aurora@hotelaria.local");
  await page.goto(UNASSIGNED);
  await expect(
    page.getByText("Sem permissão para alocar quartos."),
  ).toBeVisible();
});
