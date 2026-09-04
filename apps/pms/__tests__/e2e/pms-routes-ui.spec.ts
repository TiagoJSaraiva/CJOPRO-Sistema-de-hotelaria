import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./axe-test";

const REFERENCE_TIME = new Date("2026-05-12T15:00:00.000Z");
const TEST_TAGS = ["@visual", "@a11y"];
const MOCK_BACKEND_URL = `http://127.0.0.1:${process.env.PMS_E2E_BACKEND_PORT || "4334"}`;

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
    "catálogo próprio e categorias",
    { tag: TEST_TAGS },
    async ({ page, context, baseURL, auditAccessibility }) => {
      const browserErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      page.on("pageerror", (error) => browserErrors.push(error.message));
      await preparePage(page);
      await authenticate(context, baseURL || "http://127.0.0.1:3001");
      await page.goto(
        "/dashboard/products/view?productId=product-coffee&mode=view",
      );

      await expect(
        page.getByRole("heading", { name: "Produtos" }),
      ).toBeVisible();
      await expect(page.getByText("Café espresso")).toBeVisible();
      await expect(page.getByText(/CAF-001/)).toBeVisible();
      await page.getByRole("tab", { name: "Informações" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("tab", { name: "Preço" })).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("tab", { name: "Histórico" })).toBeFocused();
      await expect(
        page.getByRole("listitem").filter({ hasText: "Marina Costa" }),
      ).toBeVisible();

      const filterTrigger = page.getByRole("button", { name: "Filtrar dados" });
      await filterTrigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Filtros de produtos" });
      await expect(dialog).toBeVisible();
      await dialog.locator("select").nth(1).selectOption("service");
      await page.getByRole("button", { name: "Aplicar filtros" }).click();
      await expect(page.getByText("Massagem relaxante")).toBeVisible();
      await expect(page.getByText("Café espresso")).toBeHidden();

      await auditAccessibility("catalogo-proprio");
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot("products-catalog.png");

      await page.getByRole("link", { name: "Categorias" }).click();
      await expect(
        page.getByRole("heading", { name: "Categorias de produtos" }),
      ).toBeVisible();
      await expect(
        page.locator('input[name="name"][value="Frigobar"]'),
      ).toBeVisible();
      await auditAccessibility("categorias-produtos");
      expect(browserErrors).toEqual([]);
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot("product-categories.png");
    },
  );

  test(
    "configura pontos e ofertas de consumo",
    { tag: TEST_TAGS },
    async ({ page, context, baseURL, auditAccessibility }) => {
      test.setTimeout(90_000);
      await preparePage(page);
      await authenticate(
        context,
        baseURL || "http://127.0.0.1:3001",
        "consumption-e2e-token",
      );
      await page.goto("/dashboard/consumption/points");

      await expect(
        page.getByRole("heading", { name: "Vendas e consumo" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Vendas e consumo" }),
      ).toBeVisible();
      await expect(page.getByText("Recepção").first()).toBeVisible();
      await page.getByRole("button", { name: "Guia desta página" }).click();
      await expect(
        page.getByRole("dialog", { name: "Organize os canais do hotel" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await auditAccessibility("pontos-de-consumo");
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot("consumption-points.png");

      await page.getByLabel("Nome").first().fill("Restaurante");
      await page.getByLabel("Código interno").first().fill("REST");
      await page
        .getByRole("button", { name: "Criar ponto de consumo" })
        .click();
      await expect(page.getByText("Restaurante").first()).toBeVisible();
      const restaurant = page
        .getByRole("article")
        .filter({ hasText: "Restaurante" });
      await restaurant.getByRole("button", { name: "Arquivar" }).click();
      await expect(
        page
          .getByRole("article")
          .filter({ hasText: "Restaurante" })
          .getByRole("button", { name: "Restaurar" }),
      ).toBeVisible();
      await page
        .getByRole("article")
        .filter({ hasText: "Restaurante" })
        .getByRole("button", { name: "Restaurar" })
        .click();

      await page.getByRole("link", { name: "Ofertas" }).click();
      await expect(page.getByText("Café espresso").first()).toBeVisible();
      const newPointId = await page
        .getByLabel("Ponto de consumo")
        .locator("option")
        .last()
        .getAttribute("value");
      expect(newPointId).not.toBeNull();
      await page
        .getByLabel("Ponto de consumo")
        .selectOption(newPointId as string);
      await page.getByText("Massagem relaxante").first().click();
      await page
        .getByRole("button", { name: "Vincular produtos selecionados" })
        .click();
      await expect(
        page.getByText("Configuração criada com sucesso."),
      ).toBeVisible();
      await page.getByLabel("Categoria").selectOption("category-wellness");
      await expect(page.getByText("Café espresso").last()).toBeHidden();
      await page.getByLabel("Categoria").selectOption("all");
      await page
        .getByRole("combobox", { name: "Ponto", exact: true })
        .selectOption("point-reception");
      await expect(page.getByText(/oferta\(s\) encontrada\(s\)/)).toBeVisible();
      await auditAccessibility("ofertas-de-consumo");
      await page.evaluate(() => window.scrollTo(0, 0));
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot("consumption-offers.png");
    },
  );

  test(
    "configura parceiro, acordo e oferta terceirizada",
    { tag: TEST_TAGS },
    async ({ page, context, baseURL, auditAccessibility }) => {
      test.setTimeout(120_000);
      await preparePage(page);
      await authenticate(
        context,
        baseURL || "http://127.0.0.1:3001",
        "consumption-e2e-token",
      );
      await page.request.post(`${MOCK_BACKEND_URL}/test/reset-commercial`);
      await page.goto("/dashboard/consumption/partners");

      await page.getByLabel("Nome comercial").first().fill("Spa Azul E2E");
      await page.getByLabel("Razão social").first().fill("Spa Azul Ltda");
      await page.getByLabel("E-mail").first().fill("spa@example.com");
      await page.getByRole("button", { name: "Criar parceiro" }).click();
      const partnerCard = page
        .getByRole("article")
        .filter({ hasText: "Spa Azul E2E" })
        .last();
      await expect(partnerCard).toBeVisible();
      await partnerCard.locator("details").first().locator("summary").click();
      const contactForm = partnerCard.locator("form").filter({
        has: page.getByRole("button", { name: "Adicionar contato" }),
      });
      await contactForm
        .getByLabel("Nome", { exact: true })
        .fill("Ana Financeiro");
      await contactForm
        .getByLabel("E-mail", { exact: true })
        .fill("ana@spa.example");
      await contactForm
        .getByRole("button", { name: "Adicionar contato" })
        .click();
      await expect(page).toHaveURL(/status=contact-created/);

      await page.getByRole("link", { name: "Acordos" }).click();
      await page
        .locator('select[name="partner_id"]')
        .selectOption({ label: "Spa Azul E2E" });
      await page.getByLabel("Número interno").fill("AC-E2E");
      await page.locator('input[name="starts_on"]').first().fill("2026-05-01");
      await page
        .locator('select[name="commercial_model"]')
        .first()
        .selectOption("hybrid");
      await page.locator('input[name="fixed_rent"]').first().fill("500");
      await page
        .locator('select[name="rent_frequency"]')
        .first()
        .selectOption("monthly");
      await page
        .locator('input[name="commission_percentage"]')
        .first()
        .fill("8");
      await page.locator('input[name="minimum_guarantee"]').first().fill("900");
      await page
        .locator('select[name="payment_recipient"]')
        .first()
        .selectOption("both");
      await page
        .locator('input[name="point_ids"][value="point-reception"]')
        .first()
        .check();
      await page
        .getByRole("button", { name: "Criar rascunho do acordo" })
        .click();
      const agreementCard = page
        .getByRole("article")
        .filter({ hasText: "AC-E2E" })
        .last();
      await expect(agreementCard).toContainText("Rascunho");
      await agreementCard.getByText("Ativar", { exact: true }).click();
      await agreementCard
        .getByRole("button", { name: "Confirmar ativação" })
        .click();
      await expect(
        page.getByRole("article").filter({ hasText: "AC-E2E" }).last(),
      ).toContainText("Vigente");

      await page.goto("/dashboard/products/create");
      await page.getByLabel("Nome").fill("Massagem parceira E2E");
      await page.getByLabel("Categoria").selectOption("category-wellness");
      await page.getByLabel("Fornecedor").selectOption("partner");
      await page
        .getByLabel("Empresa parceira")
        .selectOption({ label: "Spa Azul E2E" });
      await page.getByLabel("Tipo").selectOption("service");
      await page.getByLabel("Unidade de venda").selectOption("service");
      await page.getByLabel("Preço unitário").fill("220");
      await page.getByRole("button", { name: "Criar item" }).click();
      await expect(page.getByText("Produto criado com sucesso.")).toBeVisible();

      await page.goto("/dashboard/consumption/offers");
      await page.getByLabel("Ponto de consumo").selectOption("point-reception");
      await page
        .locator("fieldset")
        .filter({ hasText: "Produtos do catálogo" })
        .locator("label")
        .filter({ hasText: "Massagem parceira E2E" })
        .last()
        .getByRole("checkbox")
        .check();
      await page
        .getByLabel("Acordo comercial para produtos de parceiro")
        .selectOption({ label: "AC-E2E · Spa Azul E2E" });
      await page.getByText("Sobrescrever para estas ofertas").click();
      await page
        .locator('input[name="allowed_modes"][value="partner_direct"]')
        .check();
      await page
        .locator('select[name="default_mode"]')
        .first()
        .selectOption("partner_direct");
      await page
        .getByRole("button", { name: "Vincular produtos selecionados" })
        .click();
      await expect(
        page.getByText("Massagem parceira E2E").last(),
      ).toBeVisible();
      await expect(page.getByText(/Acordo AC-E2E/).last()).toBeVisible();

      await auditAccessibility("parceiros-e-acordos-comerciais");
      await page.evaluate(() => window.scrollTo(0, 0));
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot("commercial-partners-agreements.png");
      await page.request.post(`${MOCK_BACKEND_URL}/test/reset-commercial`);
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

      const guideTrigger = page.getByRole("button", {
        name: "Guia desta página",
      });
      await guideTrigger.click();
      const guide = page.getByRole("dialog", {
        name: "Navegue pela manutenção",
      });
      await expect(guide).toBeVisible();
      await expect(page.getByRole("button", { name: "Fechar" })).toBeFocused();
      await auditAccessibility("central-manutencao-guia");
      await stabilizeVisualState(page);
      await expect(page).toHaveScreenshot("maintenance-guide.png");
      await page.getByRole("button", { name: "Fechar" }).click();
      await expect(guide).toBeHidden();
      await expect(guideTrigger).toBeFocused();

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

  test(
    "gestão preventiva, alertas e indicadores",
    { tag: ["@a11y"] },
    async ({ page, context, baseURL, auditAccessibility }) => {
      await preparePage(page);
      await authenticate(
        context,
        baseURL || "http://127.0.0.1:3001",
        "maintenance-e2e-token",
      );
      await page.goto("/dashboard/maintenance/preventive");
      await expect(
        page.getByRole("heading", { name: "Manutenção preventiva" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Revisão mensal do gerador" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Competências adiadas" }),
      ).toBeVisible();
      await auditAccessibility("gestao-preventiva");

      await page.goto("/dashboard/maintenance/notifications");
      await expect(page.getByText("SLA de resolução violado")).toBeVisible();
      await auditAccessibility("notificacoes-manutencao");

      await page.goto("/dashboard/maintenance/analytics");
      await expect(
        page.getByRole("heading", { name: "Indicadores de manutenção" }),
      ).toBeVisible();
      await expect(page.getByText("80%")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Exportar CSV detalhado" }),
      ).toBeEnabled();
      await auditAccessibility("indicadores-manutencao");
    },
  );

  test(
    "guias em todas as páginas de manutenção",
    { tag: ["@a11y"] },
    async ({ page, context, baseURL, auditAccessibility }) => {
      test.setTimeout(120_000);
      await preparePage(page);
      await authenticate(
        context,
        baseURL || "http://127.0.0.1:3001",
        "maintenance-e2e-token",
      );

      const pages = [
        ["/dashboard/maintenance/view", "Navegue pela manutenção"],
        ["/dashboard/maintenance/report", "Registre o problema"],
        [
          "/dashboard/maintenance/occurrences/97000000-0000-4000-8000-000000000001",
          "Acompanhe uma ocorrência",
        ],
        [
          "/dashboard/maintenance/finance?queue=approval",
          "Trabalhe pelas filas financeiras",
        ],
        ["/dashboard/maintenance/agenda", "Acompanhe suas ordens"],
        ["/dashboard/maintenance/preventive", "Antecipe manutenções"],
        ["/dashboard/maintenance/suppliers", "Organize o atendimento externo"],
        ["/dashboard/maintenance/settings", "Prepare os dados operacionais"],
        ["/dashboard/maintenance/sla", "Defina compromissos de atendimento"],
        [
          "/dashboard/maintenance/notifications",
          "Acompanhe exceções e vencimentos",
        ],
        ["/dashboard/maintenance/analytics", "Analise o desempenho"],
        ["/dashboard/reservations/checkout", "Revise a saída por quarto"],
      ] as const;

      for (const [path, firstStep] of pages) {
        await page.goto(path);
        const trigger = page.getByRole("button", {
          name: "Guia desta página",
        });
        await expect(trigger).toBeVisible();
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: firstStep });
        await expect(dialog).toBeVisible();
        await auditAccessibility(`guia-${path.replaceAll(/[^a-z]+/gi, "-")}`);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
      }

      await page.goto(
        "/dashboard/maintenance/occurrences/97000000-0000-4000-8000-000000000001",
      );
      const contextualHelp = page.getByRole("button", {
        name: "Ajuda: Bloqueio do quarto",
      });
      await contextualHelp.focus();
      await expect(page.getByRole("tooltip")).toContainText(
        "não libera o quarto automaticamente",
      );
      await auditAccessibility("ajuda-contextual-manutencao");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("tooltip")).toBeHidden();
      await expect(contextualHelp).toBeFocused();
    },
  );
});
