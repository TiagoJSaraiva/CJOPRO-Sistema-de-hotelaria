import { describe, expect, it } from "vitest";
import { LOGIN_SUBMIT_BUTTON_PROPS } from "../../../src/app/login/submitButtonConfig";

describe("login/page config", () => {
  it("mantem lockUntilUnmount desativado para evitar botao preso apos erro", () => {
    expect(LOGIN_SUBMIT_BUTTON_PROPS.lockUntilUnmount).toBe(false);
  });

  it("mantem feedback visual rapido de submit", () => {
    expect(LOGIN_SUBMIT_BUTTON_PROPS.pendingLabel).toBe("Entrando...");
    expect(LOGIN_SUBMIT_BUTTON_PROPS.delayMs).toBe(0);
    expect(LOGIN_SUBMIT_BUTTON_PROPS.minVisibleMs).toBe(420);
  });
});
