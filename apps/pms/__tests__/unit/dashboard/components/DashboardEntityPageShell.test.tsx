// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardEntityPageShell } from "../../../../src/app/dashboard/_components/DashboardEntityPageShell";

afterEach(() => cleanup());

describe("DashboardEntityPageShell", () => {
  it("preserva título, abas, status e conteúdo sem guia", () => {
    render(
      <DashboardEntityPageShell
        title="Entidades"
        activeTabKey="create"
        status="Ativo"
        tabs={[
          { key: "view", label: "Consultar", href: "/view", isVisible: true },
          { key: "create", label: "Criar", href: "/create", isVisible: true },
        ]}
      >
        <p>Conteúdo da página</p>
      </DashboardEntityPageShell>,
    );

    expect(screen.getByRole("heading", { name: "Entidades" })).toBeTruthy();
    expect(screen.getByText("Status: Ativo")).toBeTruthy();
    expect(screen.getByText("Conteúdo da página")).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Seções do módulo" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Guia desta página" }),
    ).toBeNull();
  });

  it("integra o acionador quando a definição possui alvo renderizado", async () => {
    render(
      <DashboardEntityPageShell
        title="Entidades"
        activeTabKey="view"
        tabs={[]}
        usageGuide={{
          id: "entities",
          title: "Entidades",
          steps: [
            {
              id: "list",
              target: "entity-list",
              title: "Lista",
              description: "Consulte as entidades disponíveis.",
            },
          ],
        }}
      >
        <div data-usage-guide="entity-list">Lista real</div>
      </DashboardEntityPageShell>,
    );

    expect(
      await screen.findByRole("button", { name: "Guia desta página" }),
    ).toBeTruthy();
  });
});
