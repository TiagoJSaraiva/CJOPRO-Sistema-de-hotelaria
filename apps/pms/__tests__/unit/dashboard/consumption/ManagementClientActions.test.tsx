// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AnalyticsExportButton,
  ConfirmSubmitButton,
  PrintManagementReportButton,
} from "../../../../src/app/dashboard/consumption/_components/ManagementClientActions";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("management client actions", () => {
  it("exports the visible analytical recut as UTF-8 CSV", async () => {
    const createObjectURL = vi.fn(() => "blob:analytics");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(
      <AnalyticsExportButton
        filename="consumo.csv"
        rows={[
          {
            key: "spa",
            label: "Spa, Azul",
            gross_sales: 120,
            operational_net: 100,
            order_count: 2,
          },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:analytics");
  });

  it("cancels a sensitive submission when confirmation is refused", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <ConfirmSubmitButton message="Aprovar versão 2?">
          Aprovar
        </ConfirmSubmitButton>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    expect(window.confirm).toHaveBeenCalledWith("Aprovar versão 2?");
    expect(submit).not.toHaveBeenCalled();
  });

  it("uses the browser print flow for the non-fiscal statement", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<PrintManagementReportButton />);
    await userEvent.click(
      screen.getByRole("button", { name: "Imprimir demonstrativo" }),
    );
    expect(print).toHaveBeenCalledOnce();
  });
});
