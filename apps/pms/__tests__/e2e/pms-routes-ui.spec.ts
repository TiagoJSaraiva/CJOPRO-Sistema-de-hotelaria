import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./axe-test";

const REFERENCE_TIME = new Date("2026-05-12T15:00:00.000Z");
const TEST_TAGS = ["@visual", "@a11y"];

async function authenticate(
  context: BrowserContext,
  baseURL: string,
  token = "e2e-token",
) {
  await context.addCookies([
    {
      name: "pms_session_token",
      value: token,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "pms_active_hotel",
      value: "hotel-e2e",
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function preparePage(page: Page) {
  await page.clock.setFixedTime(REFERENCE_TIME);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
}

async function stabilizeVisualState(page: Page) {
  await page.addStyleTag({ content: "* { cursor: none !important; }" });
  await page.evaluate(() => document.fonts.ready);
}

test.describe("PMS UI quality", () => {
  test("login", { tag: TEST_TAGS }, async ({ page, auditAccessibility }) => {
    await preparePage(page);
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Login do PMS" }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Senha")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeFocused();

    await auditAccessibility("login");
    await stabilizeVisualState(page);
    await expect(page).toHaveScreenshot("login.png");
  });

  test(
    "calendário com painel de reserva aberto",
    { tag: TEST_TAGS },
    async ({ page, context, baseURL, auditAccessibility }) => {
      await preparePage(page);
      await authenticate(context, baseURL || "http://127.0.0.1:3001");
      await page.goto("/dashboard/reservations/view?start_date=2026-05-12");

      await expect(page).toHaveTitle(/PMS/);
      await expect(
        page.getByRole("heading", { name: "Calendário de Reservas" }),
      ).toBeVisible();
      await expect(
        page.getByTestId("reservation-summary-metrics"),
      ).toContainText("Ocupação do recorte");
      await expect(
        page.getByTestId("reservation-summary-metrics"),
      ).toContainText("Estadias ativas");
      await expect(
        page.getByTestId("reservation-summary-metrics"),
      ).toContainText("Bloqueios");
      await expect(page.getByTestId("reservation-calendar-grid")).toBeVisible();
      await expect(page.getByTestId("reservation-side-panel")).toContainText(
        "Painel operacional",
      );

      await page.getByLabel("Selecionar 102 em 12/05/2026").click();
      await expect(page.getByTestId("reservation-side-panel")).toContainText(
        "Em seleção",
      );
      await page.getByRole("button", { name: "Simular" }).click();
      await expect(page.getByTestId("reservation-side-panel")).toContainText(
        "Resultado da simulação",
      );
      await expect(page.getByTestId("reservation-side-panel")).toContainText(
        "R$ 180,00",
      );

      await page
        .getByRole("button", { name: /Abrir reserva RES-1001/ })
        .click();
      await expect(page.getByTestId("reservation-side-panel")).toContainText(
        "Dados da estadia",
      );
      await expect(page.getByTestId("reservation-side-panel")).toContainText(
        "Ana Paula Ribeiro",
      );
      await expect(
        page.getByRole("button", { name: "Registrar pagamento" }),
      ).toBeDisabled();

      await auditAccessibility("calendario-painel-reserva");
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot("reservations-calendar.png");
    },
  );

  test(
    "checkout concluído",
    { tag: TEST_TAGS },
    async ({ page, context, baseURL, auditAccessibility }) => {
      await preparePage(page);
      await authenticate(context, baseURL || "http://127.0.0.1:3001");
      await page.goto("/dashboard/reservations/checkout");

      await expect(
        page.getByRole("heading", { level: 2, name: "Checkout", exact: true }),
      ).toBeVisible();
      await page.getByLabel("Numero do quarto").fill("102");
      await page.getByRole("button", { name: "Buscar" }).click();

      await expect(page.getByTestId("checkout-by-room-workflow")).toContainText(
        "Bruno Lima",
      );
      await expect(page.getByTestId("checkout-by-room-workflow")).toContainText(
        "RES-1002",
      );
      await expect(page.getByLabel("Valor")).toHaveValue("360.00");

      await page.getByRole("button", { name: "Registrar pagamento" }).click();
      await expect(page.getByTestId("checkout-by-room-workflow")).toContainText(
        "Pagamento registrado.",
      );
      await expect(page.getByLabel("Valor")).toHaveValue("");

      await page.getByRole("button", { name: "Confirmar checkout" }).click();
      await expect(page.getByTestId("checkout-by-room-workflow")).toContainText(
        "Checkout confirmado para o quarto 102.",
      );
      await expect(page.getByTestId("checkout-by-room-workflow")).toContainText(
        "Checked-out",
      );

      await auditAccessibility("checkout-concluido");
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot("reservations-checkout.png");
    },
  );

  test(
    "financeiro após aplicação de filtro",
    { tag: TEST_TAGS },
    async ({ page, context, baseURL, auditAccessibility }) => {
      await preparePage(page);
      await authenticate(context, baseURL || "http://127.0.0.1:3001");
      await page.goto("/dashboard/transactions/view");

      await expect(
        page.getByRole("heading", { name: "Painel Financeiro" }),
      ).toBeVisible();
      await expect(page.getByText("Resultado realizado")).toBeVisible();
      await expect(page.getByText("Gastos pendentes")).toBeVisible();

      const reportTrigger = page.getByRole("button", {
        name: "Gerar relatório",
      });
      await reportTrigger.focus();
      await page.keyboard.press("ArrowDown");
      const filteredReportItem = page.getByRole("menuitem", {
        name: "Recorte filtrado",
      });
      const allReportItem = page.getByRole("menuitem", {
        name: "Todas do hotel",
      });
      await expect(filteredReportItem).toBeFocused();
      await auditAccessibility("financeiro-menu-relatorios");
      await page.keyboard.press("ArrowDown");
      await expect(allReportItem).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(reportTrigger).toBeFocused();
      await expect(
        page.getByRole("menu", { name: "Opções de relatório financeiro" }),
      ).toBeHidden();

      const filterTrigger = page.getByRole("button", { name: "Filtrar dados" });
      await filterTrigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Filtros financeiros" });
      const closeDialog = page.getByRole("button", { name: "Fechar" });
      const applyFilters = page.getByRole("button", {
        name: "Aplicar filtros",
      });
      await expect(dialog).toBeVisible();
      await expect(closeDialog).toBeFocused();
      await auditAccessibility("financeiro-modal-filtros");
      await page.keyboard.press("Shift+Tab");
      await expect(applyFilters).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(closeDialog).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(filterTrigger).toBeFocused();

      await filterTrigger.click();
      await page
        .getByPlaceholder("Categoria, fornecedor, descrição ou referência")
        .fill("Energia");
      await applyFilters.click();

      await expect(
        page.getByRole("heading", { name: "Energia elétrica" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Hospedagem" }),
      ).toBeHidden();
      await expect(
        page.getByText("Exibindo 1 de 3 lançamentos financeiros."),
      ).toBeVisible();

      await auditAccessibility("financeiro-filtrado");
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot("transactions-filtered.png");
    },
  );

  test(
    "central de manutenção",
    { tag: TEST_TAGS },
    async ({ page, context, baseURL, auditAccessibility }) => {
      await preparePage(page);
      await authenticate(
        context,
        baseURL || "http://127.0.0.1:3001",
        "maintenance-e2e-token",
      );
      await page.goto("/dashboard/maintenance/view");
      await expect(
        page.getByRole("heading", { name: "Manutenção" }),
      ).toBeVisible();
      await expect(page.getByLabel("Resumo de manutenção")).toContainText(
        "Quartos bloqueados",
      );
      await expect(
        page.getByRole("link", { name: /OCO-001001/ }),
      ).toContainText("Aguardando inspeção");
      await page.getByLabel("Situação").selectOption("triaged");
      await page.getByRole("button", { name: "Filtrar" }).click();
      await expect(page).toHaveURL(/status=triaged/);
      await auditAccessibility("central-manutencao");
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot("maintenance-center.png");
    },
  );

  test(
    "financeiro de manutenção",
    { tag: TEST_TAGS },
    async ({ page, context, baseURL, auditAccessibility }) => {
      await preparePage(page);
      await authenticate(
        context,
        baseURL || "http://127.0.0.1:3001",
        "maintenance-e2e-token",
      );
      await page.goto("/dashboard/maintenance/finance?queue=approval");
      await expect(
        page.getByRole("heading", { name: "Financeiro de manutenção" }),
      ).toBeVisible();
      await expect(
        page.getByText("Substituição do televisor danificado"),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Aprovar" })).toBeEnabled();
      await auditAccessibility("financeiro-manutencao");
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot("maintenance-finance.png");
    },
  );
});
