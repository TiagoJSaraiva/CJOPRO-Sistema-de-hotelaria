// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SelectionModal } from "../../../../src/app/dashboard/_components/SelectionModal";
import { ViewFiltersModal } from "../../../../src/app/dashboard/_components/ViewFiltersBase";

afterEach(() => {
  cleanup();
});

function FilterModalHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir filtros
      </button>
      <ViewFiltersModal
        title="Filtros de teste"
        open={open}
        onClose={() => setOpen(false)}
        onApply={() => setOpen(false)}
        onClear={vi.fn()}
      >
        <label>
          Busca
          <input name="search" />
        </label>
      </ViewFiltersModal>
    </>
  );
}

function SelectionModalHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir seleção
      </button>
      <SelectionModal
        title="Escolher hotel"
        open={open}
        items={[{ id: "hotel-1", label: "Hotel Demo" }]}
        emptyMessage="Nenhum hotel"
        onSelect={vi.fn()}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

describe("modal focus management", () => {
  it("define o foco inicial, o contém e o devolve ao acionador", async () => {
    const user = userEvent.setup();
    render(<FilterModalHarness />);

    const trigger = screen.getByRole("button", { name: "Abrir filtros" });
    await user.click(trigger);

    const closeButton = screen.getByRole("button", { name: "Fechar" });
    const applyButton = screen.getByRole("button", { name: "Aplicar filtros" });
    expect(document.activeElement).toBe(closeButton);

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(applyButton);
    await user.keyboard("{Tab}");
    expect(document.activeElement).toBe(closeButton);

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Filtros de teste" }),
    ).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("fecha o seletor com Escape e restaura o foco", async () => {
    const user = userEvent.setup();
    render(<SelectionModalHarness />);

    const trigger = screen.getByRole("button", { name: "Abrir seleção" });
    await user.click(trigger);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Fechar" }),
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Escolher hotel" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
