import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// O formulário exige chegada futura; datas fixas fariam o teste expirar sozinho.
function isoDateFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

test("reserva direta e pré-chegada funcionam por categoria", async ({
  page,
}) => {
  await page.goto("/hotel/hotel-aurora");
  await expect(
    page.getByRole("heading", { name: "Hotel Aurora" }),
  ).toBeVisible();
  await page.getByLabel("Chegada").fill(isoDateFromNow(30));
  await page.getByLabel("Saída").fill(isoDateFromNow(32));
  await page.getByRole("button", { name: "Consultar categorias" }).click();
  await page.getByRole("radio").check();
  await expect(page.getByText(/Garantia: primeira diária/)).toBeVisible();
  await page.getByLabel("Nome completo").fill("Maria Silva");
  await page.getByLabel("E-mail").fill("maria@example.com");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar pré-reserva" }).click();
  await expect(page.getByRole("status")).toContainText("WEB-123");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.goto("/pre-chegada/access");
  await expect(
    page.getByRole("heading", { name: "Reserva WEB-123" }),
  ).toBeVisible();
  await page.getByLabel("Nome completo").fill("Maria Silva");
  await page.getByLabel("Tipo do documento").fill("CPF");
  await page.getByLabel("Número do documento").fill("12345678900");
  await page.getByLabel("Nascimento").fill("1990-01-01");
  await page
    .getByLabel("Nome do acompanhante 1 (Standard)")
    .fill("Bruno Treinamento");
  await page.getByRole("button", { name: "Salvar pré-chegada" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Pré-chegada registrada",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
