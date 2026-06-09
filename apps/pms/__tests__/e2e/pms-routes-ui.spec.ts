import { expect, test, type BrowserContext } from "@playwright/test";

async function authenticate(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    {
      name: "pms_session_token",
      value: "e2e-token",
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax"
    },
    {
      name: "pms_active_hotel",
      value: "hotel-e2e",
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

test.describe("PMS route visual consistency", () => {
  test("reservations route exposes the same management-dashboard patterns as transactions", async ({ page, context, baseURL }, testInfo) => {
    await authenticate(context, baseURL || "http://127.0.0.1:3001");

    await page.goto("/dashboard/reservations/view?start_date=2026-05-12");

    await expect(page).toHaveTitle(/PMS/);
    await expect(page.getByRole("heading", { name: "Calendário de Reservas" })).toBeVisible();
    await expect(page.getByTestId("reservation-summary-metrics")).toContainText("Ocupação do recorte");
    await expect(page.getByTestId("reservation-summary-metrics")).toContainText("Receita prevista");
    await expect(page.getByTestId("reservation-calendar-grid")).toBeVisible();
    await expect(page.getByTestId("reservation-side-panel")).toContainText("Painel operacional");
    await expect(page.getByRole("link", { name: "Periodo anterior" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Proximo periodo" })).toBeVisible();

    await page.getByLabel("Selecionar 102 em 12/05/2026").click();
    await expect(page.getByTestId("reservation-side-panel")).toContainText("Em selecao");
    await expect(page.getByRole("button", { name: "Simular" })).toBeEnabled();

    await page.getByRole("button", { name: "Simular" }).click();
    await expect(page.getByTestId("reservation-side-panel")).toContainText("Resultado da simulação");
    await expect(page.getByTestId("reservation-side-panel")).toContainText("R$ 180,00");

    await page.getByRole("button", { name: /Abrir reserva RES-1001/ }).click();
    await expect(page.getByTestId("reservation-side-panel")).toContainText("Dados da estadia");
    await expect(page.getByTestId("reservation-side-panel")).toContainText("Ana Paula Ribeiro");
    await expect(page.getByRole("button", { name: "Registrar pagamento" })).toBeDisabled();

    await page.screenshot({ path: testInfo.outputPath("reservations-route.png"), fullPage: false });
  });

  test("transactions route keeps its reference visual and filter interaction", async ({ page, context, baseURL }, testInfo) => {
    await authenticate(context, baseURL || "http://127.0.0.1:3001");

    await page.goto("/dashboard/transactions/view");

    await expect(page.getByRole("heading", { name: "Painel Financeiro" })).toBeVisible();
    await expect(page.getByText("Resultado realizado")).toBeVisible();
    await expect(page.getByText("Gastos pendentes")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gerar relatorio" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Novo lançamento" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Energia eletrica" })).toBeVisible();

    await page.getByRole("button", { name: "Gerar relatorio" }).click();
    await expect(page.getByRole("menu", { name: "Opcoes de relatorio financeiro" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Recorte filtrado" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Todas do hotel" })).toBeVisible();
    await page.getByRole("button", { name: "Gerar relatorio" }).click();

    await page.getByRole("button", { name: "Filtrar dados" }).click();
    await expect(page.getByRole("dialog", { name: "Filtros financeiros" })).toBeVisible();
    await page.getByPlaceholder("Categoria, fornecedor, descricao ou referencia").fill("Energia");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    await expect(page.getByRole("heading", { name: "Energia eletrica" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hospedagem" })).toBeHidden();
    await expect(page.getByText("Exibindo 1 de 3 lançamentos financeiros.")).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath("transactions-route.png"), fullPage: false });
  });
});
