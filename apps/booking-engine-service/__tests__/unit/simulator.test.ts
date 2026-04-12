import { describe, expect, it } from "vitest";
import { simulator } from "../../src/simulator";

describe("simulator", () => {
  it("retorna mensagem base enquanto o motor nao foi implementado", () => {
    expect(simulator()).toBe("Ainda nao implementado");
  });
});