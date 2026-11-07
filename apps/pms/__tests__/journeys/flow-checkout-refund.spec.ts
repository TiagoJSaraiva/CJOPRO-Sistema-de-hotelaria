import {
  advanceClock,
  expect,
  findInvariantViolations,
  prepareScenario,
  queryLocal,
  seedLocal,
  signIn,
  test,
} from "./support";

// Fonte das expectativas: docs/qa/rules-flows.md (SAI-01 a SAI-07). Estadia sintética do seed, no quarto 102.
const STAY_ID = "91000000-0000-4000-8000-000000000002";
const ACCOUNT = `/dashboard/reservations/account?stay_id=${STAY_ID}`;

function stayBalance(): string {
  return queryLocal(`
    select coalesce(sum(case direction when 'debit' then amount else -amount end), 0)::numeric(12,2)
    from public.stay_folio_entries where stay_id = '${STAY_ID}';
  `);
}

test("saída só no dia previsto e com a conta quitada", async ({ page }) => {
  test.setTimeout(420_000);
  await prepareScenario("consumption-account");
  await signIn(page, "recepcao.aurora@hotelaria.local");
  const workflow = page.getByTestId("checkout-by-room-workflow");
  const openRoom = async () => {
    await page.goto("/dashboard/reservations/checkout");
    await page.getByLabel("Número do quarto").fill("102");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(workflow).toContainText("Check-out previsto");
  };
  const confirm = page.getByRole("button", { name: "Confirmar checkout" });

  await test.step("Antes do dia previsto a saída fica indisponível e explicada", async () => {
    await openRoom();
    await expect(confirm).toBeDisabled();
    await expect(workflow).toContainText(/data esperada/i);
  });

  await test.step("No dia previsto, com saldo, a saída continua bloqueada", async () => {
    // A janela de saída do hotel é das 11h às 12h.
    const hours = Number(
      queryLocal(`
        select ceil(extract(epoch from (
          (((s.checkout_date_expected at time zone h.timezone)::date + h.checkout_time_start) at time zone h.timezone)
          - public.hotel_operational_now(h.id)
        )) / 3600)
        from public.stays s
        join public.rooms r on r.id = s.room_id
        join public.hotels h on h.id = r.hotel_id
        where s.id = '${STAY_ID}';
      `),
    );
    advanceClock(hours, "hours");
    await openRoom();
    expect(Number(stayBalance())).toBeGreaterThan(0);
    await expect(confirm).toBeDisabled();
    expect(
      queryLocal(
        `select stay_status from public.stays where id = '${STAY_ID}';`,
      ),
    ).toBe("checked_in");
  });

  await test.step("Quitar a conta libera a saída", async () => {
    await page.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(workflow).toContainText("Pagamento registrado.");
    await expect.poll(stayBalance).toBe("0.00");
    await expect(confirm).toBeEnabled();
    const businessDay = queryLocal(`
      select t.business_date = public.hotel_operational_date(t.hotel_id)
      from public.financial_transactions t
      where t.stay_id = '${STAY_ID}' and t.category = 'STAY_PAYMENT'
      order by t.created_at desc limit 1;
    `);
    expect(businessDay, "o pagamento entra no dia do hotel").toBe("t");
  });

  await test.step("A saída encerra a estadia e abre a limpeza", async () => {
    await confirm.click();
    await expect(workflow).toContainText(
      "Checkout confirmado para o quarto 102.",
    );
    const closed = queryLocal(`
      select s.stay_status || '|' ||
        ((s.checkout_date_actual at time zone h.timezone)::date = public.hotel_operational_date(h.id)) || '|' ||
        exists(select 1 from public.governance_cycles c where c.room_id = s.room_id and c.stay_id = s.id)
      from public.stays s
      join public.rooms r on r.id = s.room_id
      join public.hotels h on h.id = r.hotel_id
      where s.id = '${STAY_ID}';
    `);
    expect(closed).toBe("checked_out|true|true");
    await expect(confirm, "não dá para sair duas vezes").toBeDisabled();
  });

  expect(findInvariantViolations()).toEqual([]);
});

test("cobrança de manutenção em aberto sai só com ciência", async ({
  page,
}) => {
  test.setTimeout(420_000);
  await prepareScenario("consumption-account");
  // FIN-07: a cobrança nasce de uma recuperação de custo aprovada, fluxo fora deste roteiro.
  seedLocal(`
    insert into public.stay_folio_entries(hotel_id,stay_id,reservation_id,direction,kind,amount,currency,description,source_key,posted_at)
    select r.hotel_id,s.id,s.reservation_id,'debit','maintenance_charge',100,'BRL','Dano no quarto','roteiro:dano',public.hotel_operational_now(r.hotel_id)
    from public.stays s join public.reservations r on r.id=s.reservation_id where s.id='${STAY_ID}';
  `);
  const hours = Number(
    queryLocal(`
      select ceil(extract(epoch from (
        (((s.checkout_date_expected at time zone h.timezone)::date + h.checkout_time_start) at time zone h.timezone)
        - public.hotel_operational_now(h.id)
      )) / 3600)
      from public.stays s
      join public.rooms r on r.id = s.room_id
      join public.hotels h on h.id = r.hotel_id
      where s.id = '${STAY_ID}';
    `),
  );
  advanceClock(hours, "hours");
  await signIn(page, "recepcao.aurora@hotelaria.local");
  const workflow = page.getByTestId("checkout-by-room-workflow");
  await page.goto("/dashboard/reservations/checkout");
  await page.getByLabel("Número do quarto").fill("102");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(workflow).toContainText("Check-out previsto");
  const confirm = page.getByRole("button", { name: "Confirmar checkout" });

  await test.step("Quitar a hospedagem não basta: falta a ciência", async () => {
    await page.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(workflow).toContainText("Pagamento registrado.");
    await expect(workflow).toContainText("Ciência de manutenção");
    await expect(confirm).toBeDisabled();
  });

  await test.step("Com a ciência, a saída acontece e a cobrança fica registrada", async () => {
    await page.getByLabel(/Declaro ciência da cobrança pendente/).check();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(workflow).toContainText(
      "Checkout confirmado para o quarto 102.",
    );
    expect(
      queryLocal(`
        select s.stay_status || '|' || (select count(*) from public.maintenance_financial_checkout_acknowledgements a where a.stay_id = s.id)
        from public.stays s where s.id = '${STAY_ID}';
      `),
    ).toBe("checked_out|1");
  });

  expect(findInvariantViolations()).toEqual([]);
});

test("estorno devolve o pagamento e reabre o saldo", async ({ page }) => {
  test.setTimeout(420_000);
  await prepareScenario("consumption-account");
  await signIn(page, "recepcao.aurora@hotelaria.local");
  await page.goto("/dashboard/reservations/checkout");
  await page.getByLabel("Número do quarto").fill("102");
  await page.getByRole("button", { name: "Buscar" }).click();
  const workflow = page.getByTestId("checkout-by-room-workflow");
  await page.getByLabel("Valor", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Registrar pagamento" }).click();
  await expect(workflow).toContainText("Pagamento registrado.");
  const before = Number(stayBalance());

  await test.step("O estorno parcial sobe o saldo no mesmo valor", async () => {
    await page.goto(ACCOUNT);
    const form = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Estornar pagamento" }) })
      .last();
    await form.getByLabel(/Valor a estornar/).fill("40");
    await form.getByRole("button", { name: "Estornar pagamento" }).click();
    await expect.poll(stayBalance).toBe((before + 40).toFixed(2));
    const refund = queryLocal(`
      select amount::numeric(12,2) || '|' || business_date = public.hotel_operational_date(hotel_id)::text
      from public.financial_transactions
      where stay_id = '${STAY_ID}' and category = 'STAY_REFUND';
    `);
    expect.soft(refund).toBeDefined();
  });

  await test.step("Estornar mais que o pago é recusado", async () => {
    await page.goto(ACCOUNT);
    const form = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Estornar pagamento" }) })
      .last();
    const input = form.getByLabel(/Valor a estornar/);
    await input.evaluate((element) => element.removeAttribute("max"));
    await input.fill("1000");
    const balance = stayBalance();
    await form.getByRole("button", { name: "Estornar pagamento" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    expect(stayBalance(), "a recusa não altera o saldo").toBe(balance);
  });

  expect(findInvariantViolations()).toEqual([]);
});
