// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const { errorParam } = vi.hoisted(() => ({ errorParam: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: errorParam }),
}));
import { LoginErrorMessage } from "../../../src/app/login/_components/LoginErrorMessage";

afterEach(cleanup);
describe("LoginErrorMessage", () => {
  it("explica a falha de sessão", () => {
    errorParam.mockReturnValue("session_too_large");
    render(<LoginErrorMessage />);
    expect(
      screen.getByText(
        "Não foi possível iniciar sua sessão. Entre em contato com o administrador para revisar seus acessos.",
      ),
    ).toBeTruthy();
  });
  it.each([null, "unknown"])("não exibe erro para %s", (error) => {
    errorParam.mockReturnValue(error);
    const { container } = render(<LoginErrorMessage />);
    expect(container.textContent).toBe("");
  });
  it.each(["missing_fields", "invalid_credentials"])(
    "preserva o erro %s",
    (error) => {
      errorParam.mockReturnValue(error);
      const { container } = render(<LoginErrorMessage />);
      expect(container.textContent).not.toBe("");
    },
  );
});
