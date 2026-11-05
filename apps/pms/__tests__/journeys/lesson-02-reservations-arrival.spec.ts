import {
  expect,
  findInvariantViolations,
  prepareScenario,
  queryLocal,
  signIn,
  test,
} from "./support";

// Fonte das expectativas: docs/training/lesson-02-reservations-arrival.md
const STAY_ID = "91000000-0000-4000-8000-000000000001";
const AURORA_ID = "10000000-0000-4000-8000-000000000001";
const ROOM_103_ID = "20000000-0000-4000-8000-000000000103";
const CUSTOMER_ID = "30000000-0000-4000-8000-000000000001";

function displayDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

test("lição 2: reserva, garantia e chegada", async ({ page, context }) => {
  await prepareScenario("reservations-arrival");

  const panel = page.getByTestId("reservation-side-panel");
  const openReservation = async () => {
    await page
      .getByRole("button", { name: /Abrir reserva LOCAL-AUR-001/ })
      .first()
      .click();
    await expect(panel).toContainText("LOCAL-AUR-001");
  };

  await test.step("1. Abrir LOCAL-AUR-001 pelo calendário", async () => {
    await signIn(page, "recepcao.aurora@hotelaria.local");
    await page.goto("/dashboard/reservations/view");
    await expect(page.getByTestId("reservation-calendar-grid")).toBeVisible();
    await openReservation();
  });

  await test.step("2. Conferir titular, hóspedes, categoria e valores", async () => {
    await expect.soft(panel).toContainText("Dados da estadia");
    await expect.soft(panel).toContainText("101");
    await expect.soft(panel).toContainText("Chegada e adiantamento");
    await expect.soft(panel).toContainText("Quantidade de hóspedes");
    await expect.soft(panel).toContainText("Standard");
    await expect.soft(panel).toContainText(/R\$\s*250,00/);
    await expect.soft(panel).toContainText(/R\$\s*500,00/);
  });

  await test.step("3. Registrar sinal de R$ 250 via Pix", async () => {
    await expect.soft(panel).toContainText(/primeira diária/i);
    await expect.soft(panel).toContainText("Exigido");
    await expect.soft(panel).toContainText("Recebido");
    await panel.getByLabel("Meio de pagamento recebido").selectOption("pix");
    const amount = panel.getByLabel("Valor efetivamente recebido (R$)");
    await expect.soft(amount).toHaveValue(/^250([.,]0+)?$/);
    await panel
      .getByLabel("Referência ou observação (opcional)")
      .fill("PIX-LESSON-02");
    await panel
      .getByRole("button", { name: "Registrar adiantamento recebido" })
      .click();
    await expect(panel).toContainText("Exigência atendida");
    await expect.soft(panel).toContainText("Financeiro");
    await expect.soft(panel).toContainText(/adiantamento a transferir/i);
    await expect.soft(panel).toContainText(/saldo a pagar/i);
  });

  await test.step("Banco: sinal ainda fora da conta antes da chegada", async () => {
    const credits = queryLocal(`
      select count(*) from public.stay_folio_entries
      where stay_id = '${STAY_ID}' and direction = 'credit';
    `);
    expect.soft(Number(credits)).toBe(0);
  });

  await test.step("4. Quarto 101 pronto e bloqueio do 103 explicado", async () => {
    await expect.soft(panel).toContainText("Prontidão do quarto");
    await expect.soft(panel).toContainText("Quarto liberado para chegada");

    const tomorrow = queryLocal(`
      select (public.hotel_operational_date('${AURORA_ID}') + 1)::text;
    `);
    const blockText = page.getByText(/Limpeza programada/).first();
    await expect.soft(blockText, "o bloqueio mostra o motivo").toBeVisible();
    await expect
      .soft(blockText, "o bloqueio mostra o período")
      .toContainText(displayDate(tomorrow));

    // Erro proposital: a data bloqueada não pode ser selecionada pela tela...
    const blockedCell = page.getByRole("button", {
      name: new RegExp(`selecionar 103 em ${displayDate(tomorrow)}`, "i"),
    });
    await expect
      .soft(blockedCell, "data bloqueada não pode ser selecionada")
      .toBeDisabled();

    // ...nem reservada diretamente pela API, sem passar pela tela.
    const bypass = await page.request.post(
      "/api/reservations-calendar/simulate",
      {
        data: {
          booking_customer: { mode: "existing", customer_id: CUSTOMER_ID },
          selected_cells: [
            { room_id: ROOM_103_ID, date: tomorrow, side: "full" },
          ],
          reservation_source: null,
          notes: null,
        },
      },
    );
    expect.soft(bypass.status(), "API recusa data bloqueada").toBe(409);
    expect
      .soft(await bypass.text(), "a recusa explica o bloqueio do período")
      .toContain("bloqueados no período selecionado");

    // QA-004: o bloqueio vale só para o período; fora dele o 103 pode ser reservado.
    const later = queryLocal(`
      select (public.hotel_operational_date('${AURORA_ID}') + 10)::text;
    `);
    const available = await page.request.post(
      "/api/reservations-calendar/simulate",
      {
        data: {
          booking_customer: { mode: "existing", customer_id: CUSTOMER_ID },
          selected_cells: [{ room_id: ROOM_103_ID, date: later, side: "full" }],
          reservation_source: null,
          notes: null,
        },
      },
    );
    expect.soft(available.status(), "103 livre fora do bloqueio").toBe(200);
  });

  const publicPage =
    await test.step("5. Gerar link e enviar a pré-chegada pelo site público", async () => {
      await panel
        .getByRole("button", { name: "Gerar link de pré-chegada" })
        .click();
      const popupPromise = context.waitForEvent("page");
      await panel
        .getByRole("link", { name: "Abrir formulário público" })
        .click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      await popup.getByLabel("Horário previsto").fill("14:00");
      await popup.getByLabel("Nome completo").fill("Ana Treinamento");
      await popup.getByLabel("Tipo do documento").fill("treinamento");
      await popup.getByLabel("Número do documento").fill("LOCAL-ANA-02");
      await popup.getByLabel("Nascimento").fill("1990-01-10");
      await popup
        .getByLabel(/Nome do acompanhante 1/)
        .fill("Bruno Treinamento");
      await popup.getByRole("button", { name: "Salvar pré-chegada" }).click();
      await expect(popup.getByRole("status")).toContainText(
        "Pré-chegada registrada",
      );
      return popup;
    });
  await publicPage.close();

  await test.step("5b. Painel mostra o envio após atualizar", async () => {
    await panel.getByRole("button", { name: "Atualizar envio" }).click();
    await expect.soft(panel).toContainText("14:00");
    await expect.soft(panel).toContainText("Ana Treinamento");
    await expect.soft(panel).toContainText("Bruno Treinamento");
  });

  await test.step("6. Check-in dentro da janela operacional", async () => {
    await expect.soft(panel).toContainText("Horário operacional");
    await panel.getByRole("button", { name: "Check-in", exact: true }).click();
    await expect(panel).toContainText(/Checked-in|em andamento|hospedad/i);
  });

  await test.step("Banco: estadia ativa, chegada às 14h e sinal transferido uma vez", async () => {
    const stay = queryLocal(`
      select stay_status || '|' ||
        to_char(checkin_date_actual at time zone 'America/Sao_Paulo', 'HH24')
      from public.stays where id = '${STAY_ID}';
    `);
    expect.soft(stay).toBe("checked_in|14");
    const credits = queryLocal(`
      select count(*) || '|' || coalesce(sum(amount), 0)::numeric(12,2)
      from public.stay_folio_entries
      where stay_id = '${STAY_ID}' and direction = 'credit';
    `);
    expect.soft(credits).toBe("1|250.00");
  });

  await test.step("Verificação final: conta mostra o crédito e saldo de R$ 250", async () => {
    await page.goto(`/dashboard/reservations/account?stay_id=${STAY_ID}`);
    await expect
      .soft(page.getByText("Sinal da reserva transferido na chegada").first())
      .toBeVisible();
    await expect.soft(page.getByText(/R\$\s*250,00/).first()).toBeVisible();
  });

  await test.step("Opcional: lançar consumo no fólio após a chegada", async () => {
    await page.goto("/dashboard/reservations/view");
    await openReservation();
    await page
      .getByRole("link", { name: "Lançar consumo", exact: true })
      .click();
    await expect(page).toHaveURL(/consumption\/launch\?stay_id=/);
    const quantity = page
      .getByRole("spinbutton", { name: /^Quantidade de / })
      .first();
    await expect(quantity).toBeVisible();
    await quantity.fill("1");
    await expect
      .soft(page.getByRole("radio", { name: "Lançamento no fólio" }))
      .toBeChecked();
    await page.getByRole("button", { name: "Revisar comanda" }).click();
    await page.getByRole("button", { name: "Confirmar lançamento" }).click();
    await expect(page.getByText("Comanda lançada")).toBeVisible();
  });

  await test.step("Banco: consumo debitado uma vez, depois da chegada e no relógio do hotel", async () => {
    const consumption = queryLocal(`
      select count(*) || '|' || bool_and(
        o.occurred_at >= s.checkin_date_actual
        and o.occurred_at <= public.hotel_operational_now('${AURORA_ID}')
      )
      from public.consumption_orders o
      join public.stays s on s.id = o.stay_id
      where o.stay_id = '${STAY_ID}';
    `);
    expect.soft(consumption).toBe("1|true");
  });

  await test.step("Invariantes de negócio ao final da jornada", async () => {
    expect.soft(findInvariantViolations()).toEqual([]);
  });
});
