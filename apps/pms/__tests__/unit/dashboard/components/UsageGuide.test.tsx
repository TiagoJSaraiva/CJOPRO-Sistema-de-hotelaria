// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContextHelp } from "../../../../src/app/dashboard/_components/ContextHelp";
import {
  UsageGuide,
  validateUsageGuideDefinition,
  type UsageGuideDefinition,
} from "../../../../src/app/dashboard/_components/UsageGuide";

const definition: UsageGuideDefinition = {
  id: "test-guide",
  title: "Guia de teste",
  steps: [
    {
      id: "summary",
      target: "summary",
      title: "Resumo",
      description: "Confira os números antes de continuar.",
    },
    {
      id: "filters",
      target: "filters",
      title: "Filtros",
      description: "Restrinja os resultados exibidos.",
    },
  ],
};

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    value: 1024,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: 768,
    configurable: true,
  });
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 100,
    left: 100,
    right: 500,
    bottom: 220,
    width: 400,
    height: 120,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  });
});

afterEach(() => cleanup());

function Harness({ includeFilters = true }: { includeFilters?: boolean }) {
  return (
    <>
      <UsageGuide definition={definition} />
      <section data-usage-guide="summary">Resumo real</section>
      {includeFilters ? (
        <form data-usage-guide="filters">Filtros reais</form>
      ) : null}
    </>
  );
}

describe("UsageGuide", () => {
  it("percorre passos, contém o foco e conclui devolvendo-o ao acionador", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const launcher = await screen.findByRole("button", {
      name: "Guia desta página",
    });

    await user.click(launcher);
    expect(screen.getByRole("dialog", { name: "Resumo" })).toBeTruthy();
    expect(screen.getByText(/Passo 1 de 2/)).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    const close = screen.getByRole("button", { name: "Fechar" });
    const next = screen.getByRole("button", { name: "Próximo" });
    expect(document.activeElement).toBe(close);
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(next);
    await user.keyboard("{Tab}");
    expect(document.activeElement).toBe(close);

    await user.click(next);
    expect(screen.getByRole("dialog", { name: "Filtros" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByRole("dialog", { name: "Resumo" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Próximo" }));
    await user.click(screen.getByRole("button", { name: "Concluir" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(launcher));
    expect(document.body.style.overflow).toBe("");
  });

  it("ignora alvos ausentes e fecha com Escape", async () => {
    const user = userEvent.setup();
    render(<Harness includeFilters={false} />);
    const launcher = await screen.findByRole("button", {
      name: "Guia desta página",
    });
    await user.click(launcher);

    expect(screen.getByText(/Passo 1 de 1/)).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(launcher);
  });

  it("não mostra acionador quando nenhum alvo está disponível", async () => {
    render(<UsageGuide definition={definition} />);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Guia desta página" }),
      ).toBeNull(),
    );
  });

  it("detecta conteúdo vazio e identificadores duplicados", () => {
    expect(
      validateUsageGuideDefinition({
        id: "",
        title: "",
        steps: [definition.steps[0]!, definition.steps[0]!],
      }),
    ).toEqual(
      expect.arrayContaining([
        "O guia precisa de um identificador.",
        "O guia precisa de um título.",
        "Passo duplicado: summary.",
        "Alvo duplicado: summary.",
      ]),
    );
  });
});

describe("ContextHelp", () => {
  it("abre por hover e foco e fecha por Escape", async () => {
    const user = userEvent.setup();
    render(<ContextHelp label="Bloqueio">Explicação do bloqueio.</ContextHelp>);
    const trigger = screen.getByRole("button", { name: "Ajuda: Bloqueio" });

    await user.hover(trigger);
    expect(screen.getByRole("tooltip").textContent).toBe(
      "Explicação do bloqueio.",
    );
    await user.unhover(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();

    await user.tab();
    expect(screen.getByRole("tooltip")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("fixa por clique e fecha por novo clique ou clique externo", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ContextHelp label="SLA">Explicação do SLA.</ContextHelp>
        <button type="button">Fora</button>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "Ajuda: SLA" });

    await user.click(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    await user.click(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Fora" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
