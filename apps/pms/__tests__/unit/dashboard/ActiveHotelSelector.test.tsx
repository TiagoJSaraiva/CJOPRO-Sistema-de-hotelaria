// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { ActiveHotelContext } from "../../../src/app/dashboard/_components/ActiveHotelSelector";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const onChangeAction = vi.fn(async () => undefined);

it("identifica o hotel ativo mesmo quando a conta só possui um hotel", () => {
  render(
    <ActiveHotelContext
      options={[{ hotelId: "aurora", label: "Hotel Aurora" }]}
      initialHotelId="aurora"
      onChangeAction={onChangeAction}
    />,
  );

  expect(screen.getByText("Hotel ativo:")).toBeTruthy();
  expect(screen.getByText("Hotel Aurora")).toBeTruthy();
  expect(screen.queryByRole("combobox")).toBeNull();
});

it("mantém a troca disponível quando existem vários contextos", () => {
  render(
    <ActiveHotelContext
      options={[
        { hotelId: "aurora", label: "Hotel Aurora" },
        { hotelId: "horizonte", label: "Hotel Horizonte" },
      ]}
      initialHotelId="horizonte"
      onChangeAction={onChangeAction}
    />,
  );

  expect(
    screen.getByText("Hotel Horizonte", { selector: "strong" }),
  ).toBeTruthy();
  expect(
    (
      screen.getByRole("combobox", {
        name: "Trocar hotel",
      }) as HTMLSelectElement
    ).value,
  ).toBe("horizonte");
});
