import type { Page } from "@playwright/test";
import {
  expect,
  findInvariantViolations,
  prepareScenario,
  queryLocal,
  signIn,
  test,
} from "./support";

// Fonte das expectativas: docs/training/lesson-03-channels.md. Canal fictício e dados sintéticos.
const AURORA_ID = "10000000-0000-4000-8000-000000000001";
const MANAGER = "gerente.aurora@hotelaria.local";
const CHANNELS = "/dashboard/reservations/channels";
const CSV_HEADER =
  "event_id,event_type,external_reservation_id,occurred_at,room_code,rate_code,checkin_date,checkout_date,adults,children,currency,total,guest_name,guest_email,guest_phone";

function operationalDatePlus(days: number): string {
  return queryLocal(
    `select public.hotel_operational_date('${AURORA_ID}') + ${days};`,
  );
}

function eventLine(id: string, roomCode: string): string {
  return [
    id,
    "create",
    `RES-${id}`,
    `${operationalDatePlus(0)}T12:00:00Z`,
    roomCode,
    "FLEX",
    operationalDatePlus(10),
    operationalDatePlus(12),
    "2",
    "0",
    "BRL",
    "500",
    "Hóspede Exemplo",
    "guest@example.invalid",
    "+551100000000",
  ].join(",");
}

function eventRow(externalId: string): string {
  return queryLocal(`
    select status || '|' || (reservation_id is not null)
    from public.booking_channel_events
    where hotel_id = '${AURORA_ID}' and external_event_id = '${externalId}';
  `);
}

async function saveMapping(page: Page) {
  await page.getByLabel("Código externo da categoria").fill("DESCONHECIDO");
  const categories = page.getByLabel("Categoria interna");
  await categories.selectOption({ index: 1 });
  await page.getByLabel("Código externo da tarifa").fill("FLEX");
  await page.getByLabel("Plano tarifário interno").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Salvar mapeamento" }).click();
  await expect(page.getByRole("status").first()).toContainText(
    "Mapeamento salvo",
  );
}

test("lição 3: site direto, conexão, mapeamento e revisão", async ({
  page,
}) => {
  await prepareScenario("channels");
  let secret = "";

  await test.step("1-2. Canais separa site direto de conexão externa", async () => {
    await signIn(page, MANAGER);
    await page.goto(CHANNELS);
    await expect
      .soft(page.getByRole("heading", { name: "Venda direta" }))
      .toBeVisible();
    await expect
      .soft(page.getByRole("heading", { name: "Nova conexão de canal" }))
      .toBeVisible();
    await expect.soft(page.getByLabel("Termos")).not.toHaveValue("");
    await page.getByRole("button", { name: "Salvar configuração" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Configuração de venda direta atualizada",
    );
  });

  await test.step("3-4. Criar a conexão mostra o segredo uma única vez", async () => {
    await page
      .getByPlaceholder("HospedaLink Sandbox")
      .fill("HospedaLink Sandbox");
    await page.getByPlaceholder("HOSPEDALINK-AURORA").fill("AURORA-DEMO");
    await page.getByRole("button", { name: "Criar conexão" }).click();
    const output = page.getByLabel("Segredo do canal");
    await expect(output).toBeVisible();
    secret = (await output.textContent()) ?? "";
    expect(secret.length).toBeGreaterThan(10);
    const digest = queryLocal(`
      select credential_digest from public.booking_channels
      where hotel_id = '${AURORA_ID}' and code = 'AURORA-DEMO';
    `);
    expect.soft(digest, "o banco guarda só o resumo").not.toBe(secret);

    await page.reload();
    await expect
      .soft(page.locator("main, body").first(), "o segredo não reaparece")
      .not.toContainText(secret);
    await expect
      .soft(page.getByText("HospedaLink Sandbox").first())
      .toBeVisible();
  });

  await test.step("Erro proposital: conexão repetida explica a recusa", async () => {
    await page
      .getByPlaceholder("HospedaLink Sandbox")
      .fill("HospedaLink Sandbox");
    await page.getByPlaceholder("HOSPEDALINK-AURORA").fill("AURORA-DEMO");
    await page.getByRole("button", { name: "Criar conexão" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect.soft(page.getByLabel("Segredo do canal")).toHaveCount(0);
  });

  await test.step("6-7 e erro proposital: categoria sem mapeamento fica em revisão", async () => {
    await page.goto(CHANNELS);
    await expect
      .soft(page.getByLabel("Conteúdo CSV"), "a amostra não descreve o passado")
      .toHaveValue(new RegExp(operationalDatePlus(14)));
    await page
      .getByLabel("Conteúdo CSV")
      .fill(`${CSV_HEADER}\n${eventLine("HL-900", "DESCONHECIDO")}`);
    await page.getByRole("button", { name: "Importar para revisão" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Arquivo importado",
    );
    await expect.poll(() => eventRow("HL-900")).toBe("needs_review|false");
    const inbox = page.locator('[data-usage-guide="channel-inbox"]');
    await expect.soft(inbox).toContainText("HospedaLink Sandbox");
    await expect
      .soft(inbox, "a situação do evento vem em português")
      .not.toContainText("needs_review");
  });

  await test.step("5 e solução: mapear e reprocessar cria a reserva uma vez", async () => {
    const inbox = page.locator('[data-usage-guide="channel-inbox"]');
    const pending = inbox.locator("article", { hasText: "RES-HL-900" });
    // Aplicar antes de mapear explica a recusa e não cria reserva.
    await pending.getByPlaceholder("Motivo da decisão").fill("Tentativa cedo");
    await pending.getByRole("button", { name: "Registrar decisão" }).click();
    await expect(page.getByRole("alert").first()).toContainText("falta mapear");
    expect.soft(eventRow("HL-900")).toBe("needs_review|false");

    await saveMapping(page);
    const mapped = page
      .locator('[data-usage-guide="channel-inbox"] article', {
        hasText: "RES-HL-900",
      })
      .first();
    await mapped
      .getByPlaceholder("Motivo da decisão")
      .fill("Mapeamento criado");
    await mapped.getByRole("button", { name: "Registrar decisão" }).click();
    await expect(page.getByRole("status").first()).toContainText(
      "Evento de canal atualizado",
    );
    await expect.poll(() => eventRow("HL-900")).toBe("applied|true");

    // Decidido, sai da fila e não oferece nova decisão.
    const decided = page.locator('[data-usage-guide="channel-inbox"] article', {
      hasText: "RES-HL-900",
    });
    await expect.soft(decided).toContainText("Aplicado");
    await expect
      .soft(decided.getByRole("button", { name: "Registrar decisão" }))
      .toHaveCount(0);
  });

  await test.step("Banco: reimportar o mesmo evento não duplica a reserva", async () => {
    const before = queryLocal(
      `select count(*) from public.reservations where hotel_id = '${AURORA_ID}';`,
    );
    await page
      .getByLabel("Conteúdo CSV")
      .fill(`${CSV_HEADER}\n${eventLine("HL-900", "DESCONHECIDO")}`);
    await page.getByRole("button", { name: "Importar para revisão" }).click();
    await expect(page.getByRole("status").first()).toBeVisible();
    const after = queryLocal(
      `select count(*) from public.reservations where hotel_id = '${AURORA_ID}';`,
    );
    expect.soft(after).toBe(before);
    expect.soft(findInvariantViolations()).toEqual([]);
  });
});
