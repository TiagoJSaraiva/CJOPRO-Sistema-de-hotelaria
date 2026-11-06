import { describe, expect, it } from "vitest";
import { whenForbidden } from "../../../src/lib/whenForbidden";

const failure = (statusCode?: number) =>
  Object.assign(new Error("falha"), { statusCode });

describe("whenForbidden", () => {
  it("usa o valor padrão para quem não tem permissão", async () => {
    await expect(
      Promise.reject(failure(403)).catch(whenForbidden([])),
    ).resolves.toEqual([]);
  });

  it.each([400, 404, 409, 500, undefined])(
    "propaga a falha com status %s",
    async (status) => {
      await expect(
        Promise.reject(failure(status)).catch(whenForbidden([])),
      ).rejects.toThrow("falha");
    },
  );

  it("propaga falhas que não são de requisição", async () => {
    await expect(
      Promise.reject(null).catch(whenForbidden([])),
    ).rejects.toBeNull();
  });
});
