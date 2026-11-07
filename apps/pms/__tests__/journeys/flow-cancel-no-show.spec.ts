import {
  advanceClock,
  expect,
  findInvariantViolations,
  prepareScenario,
  queryLocal,
  signIn,
  test,
} from "./support";

// Fonte das expectativas: docs/qa/rules-flows.md (RES-01 a RES-08). Dados sintéticos do cenário da lição 2.
const STAY_ID = "91000000-0000-4000-8000-000000000001";

function closureState(): string {
  return queryLocal(`
    select s.stay_status || '|' || r.lifecycle_status || '|' || a.status
    from public.stays s
    join public.reservations r on r.id = s.reservation_id
    join public.reservation_accommodations a on a.stay_id = s.id
    where s.id = '${STAY_ID}';
  `);
}

function closureBalance(): string {
  return queryLocal(`
    select public.reservation_closure_balance(reservation_id)::numeric(12,2)
    from public.stays where id = '${STAY_ID}';
  `);
}

test.describe.configure({ mode: "serial" });

test("cancelar libera o quarto e devolve o adiantamento", async ({ page }) => {
  test.setTimeout(300_000);
  await prepareScenario("reservations-arrival");
  await signIn(page, "recepcao.aurora@hotelaria.local");
  await page.goto("/dashboard/reservations/view");
  await page
    .getByRole("button", { name: /Abrir reserva LOCAL-AUR-001/ })
    .first()
    .click();
  const panel = page.getByTestId("reservation-side-panel");
  await expect(panel).toContainText("LOCAL-AUR-001");

  await test.step("Registrar o adiantamento", async () => {
    await panel.getByLabel("Meio de pagamento recebido").selectOption("pix");
    await panel
      .getByRole("button", { name: "Registrar adiantamento recebido" })
      .click();
    await expect(panel).toContainText("Exigência atendida");
  });

  await test.step("A confirmação mostra o valor e pede o motivo", async () => {
    await panel.getByRole("button", { name: "Cancelar", exact: true }).click();
    const confirmation = panel.getByRole("group", {
      name: "Confirmar cancelamento",
    });
    await expect(confirmation).toContainText("Multa do plano");
    await expect(confirmation).toContainText(/A devolver\s*R\$\s*250,00/);
    await expect(
      confirmation.getByRole("button", { name: "Confirmar cancelamento" }),
    ).toBeDisabled();
    expect(closureState()).toBe("confirmed|confirmed|assigned");
    await confirmation.getByLabel("Motivo").fill("Pedido do hóspede");
    await confirmation
      .getByRole("button", { name: "Confirmar cancelamento" })
      .click();
  });

  await test.step("Estadia, reserva e acomodação terminam juntas", async () => {
    await expect(
      panel.getByRole("heading", { name: "Devolver crédito" }),
    ).toBeVisible();
    expect(closureState()).toBe("canceled|canceled|canceled");
    expect(closureBalance()).toBe("250.00");
    const lodging = queryLocal(`
      select coalesce(sum(case direction when 'debit' then amount else -amount end), 0)::numeric(12,2)
      from public.stay_folio_entries where stay_id = '${STAY_ID}';
    `);
    expect.soft(lodging, "a hospedagem sai da conta").toBe("0.00");
  });

  await test.step("O quarto não aparece mais ocupado", async () => {
    const holding = queryLocal(`
      select count(*) from public.stays
      where id = '${STAY_ID}' and stay_status in ('confirmed', 'checked_in');
    `);
    expect(holding).toBe("0");
  });

  await test.step("Devolver o crédito zera o saldo", async () => {
    await panel.getByRole("button", { name: "Registrar devolução" }).click();
    await expect(
      panel.getByRole("heading", { name: "Devolver crédito" }),
    ).toHaveCount(0);
    expect(closureBalance()).toBe("0.00");
    const refund = queryLocal(`
      select type || '|' || category || '|' || amount::numeric(12,2)
      from public.financial_transactions t
      join public.stays s on s.reservation_id = t.reservation_id
      where s.id = '${STAY_ID}' and t.category = 'RESERVATION_REFUND';
    `);
    expect(refund).toBe("REFUND|RESERVATION_REFUND|250.00");
  });

  expect(findInvariantViolations()).toEqual([]);
});

test("no-show só depois do limite de check-in", async ({ page }) => {
  test.setTimeout(300_000);
  await prepareScenario("reservations-arrival");
  await signIn(page, "recepcao.aurora@hotelaria.local");
  await page.goto("/dashboard/reservations/view");
  const open = () =>
    page
      .getByRole("button", { name: /Abrir reserva LOCAL-AUR-001/ })
      .first()
      .click();
  await open();
  const panel = page.getByTestId("reservation-side-panel");
  await expect(panel).toContainText("LOCAL-AUR-001");

  await test.step("Antes do limite a ação fica indisponível e explicada", async () => {
    await expect(
      panel.getByRole("button", { name: "No-show", exact: true }),
    ).toBeDisabled();
    await expect(panel).toContainText(/somente ap[oó]s o limite de check-in/i);
  });

  await test.step("Depois do limite o no-show encerra tudo", async () => {
    advanceClock(1, "days");
    await page.reload();
    await open();
    await panel.getByRole("button", { name: "No-show", exact: true }).click();
    const confirmation = panel.getByRole("group", {
      name: "Confirmar no-show",
    });
    await confirmation.getByLabel("Motivo").fill("Hóspede não compareceu");
    await confirmation
      .getByRole("button", { name: "Confirmar no-show" })
      .click();
    await expect
      .poll(closureState, { timeout: 30_000 })
      .toBe("no_show|no_show|no_show");
    const event = queryLocal(`
      select e.details->>'business_date' = public.hotel_operational_date(r.hotel_id)::text
      from public.reservation_events e
      join public.reservations r on r.id = e.reservation_id
      join public.stays s on s.reservation_id = r.id
      where s.id = '${STAY_ID}' and e.action = 'no_show';
    `);
    expect(event, "o no-show entra no dia de negócio do hotel").toBe("t");
  });

  expect(findInvariantViolations()).toEqual([]);
});
