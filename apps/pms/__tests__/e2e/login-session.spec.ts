import { expect, test } from "./axe-test";

const password = "Synthetic-session-test-123!";
const backend = `http://127.0.0.1:${process.env.PMS_E2E_BACKEND_PORT || "4334"}`;

test.describe("login com sessão compacta", () => {
  test("@a11y informa sessão grande demais e remove os cookies anteriores", async ({
    page,
    context,
    request,
    baseURL,
    auditAccessibility,
  }) => {
    const login = await request.post(`${backend}/auth/login`, {
      data: { email: "aurora@session.test", password },
    });
    const { token } = await login.json();
    await context.addCookies([
      {
        name: "pms_session_token",
        value: token,
        url: baseURL!,
        httpOnly: true,
        sameSite: "Lax",
      },
      {
        name: "pms_active_hotel",
        value: "hotel-e2e",
        url: baseURL!,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/login");
    await page
      .getByLabel("Email", { exact: true })
      .fill("oversized@session.test");
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/login\?error=session_too_large$/);
    await expect(
      page.getByText("Não foi possível iniciar sua sessão.", { exact: false }),
    ).toBeVisible();
    expect(
      (await context.cookies()).filter((cookie) =>
        ["pms_session_token", "pms_active_hotel"].includes(cookie.name),
      ),
    ).toEqual([]);
    await auditAccessibility("erro-sessao-grande");
  });

  test("entra pelo formulário, preserva manutenção após recarregar e sai", async ({
    page,
    context,
    auditAccessibility,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("aurora@session.test");
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    // Next dev may still be rendering the redirected page after the login
    // response; allow the same navigation budget as the browser runner.
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    await expect(
      page.getByText("Gerente A. Teste", { exact: true }),
    ).toBeVisible();
    const cookie = (await context.cookies()).find(
      (item) => item.name === "pms_session_token",
    )!;
    expect(cookie.value).toMatch(/^v2\./);
    expect(Buffer.byteLength(cookie.value)).toBeLessThan(3800);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    await page.getByRole("link", { name: "Manutenção", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Manutenção", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Manutenção", exact: true }),
    ).toBeVisible();
    await auditAccessibility("manutencao-login-real");
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(
      (await context.cookies()).filter((item) =>
        ["pms_session_token", "pms_active_hotel"].includes(item.name),
      ),
    ).toEqual([]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("substitui sessão anterior e resolve o hotel da nova conta", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    const oldLogin = await request.post(`${backend}/auth/login`, {
      data: { email: "horizonte@session.test", password },
    });
    expect(oldLogin.ok()).toBe(true);
    const oldToken = (await oldLogin.json()).token;
    await context.addCookies([
      {
        name: "pms_session_token",
        value: oldToken,
        url: baseURL!,
        httpOnly: true,
        sameSite: "Lax",
      },
      {
        name: "pms_active_hotel",
        value: "hotel-horizonte",
        url: baseURL!,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("aurora@session.test");
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    const cookies = await context.cookies();
    expect(
      cookies.find((cookie) => cookie.name === "pms_session_token")?.value,
    ).not.toBe(oldToken);
    expect(
      cookies.find((cookie) => cookie.name === "pms_active_hotel")?.value,
    ).toBe("hotel-e2e");
    await expect(
      page.getByText("Gerente A. Teste", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Manutenção", exact: true }),
    ).toBeVisible();
  });
});
