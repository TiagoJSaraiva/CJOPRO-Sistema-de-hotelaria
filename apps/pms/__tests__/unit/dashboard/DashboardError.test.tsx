// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DashboardError from "../../../src/app/dashboard/error";

afterEach(cleanup);

it("explica a falha em português e oferece as saídas", () => {
  render(<DashboardError reset={vi.fn()} />);
  expect(screen.getByRole("alert").textContent).toContain(
    "Não foi possível carregar esta tela",
  );
  expect(
    screen.getByRole("link", { name: "Voltar ao início" }).getAttribute("href"),
  ).toBe("/dashboard");
});

it("tentar novamente recarrega a tela", () => {
  const reset = vi.fn();
  render(<DashboardError reset={reset} />);
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(reset).toHaveBeenCalledOnce();
});
