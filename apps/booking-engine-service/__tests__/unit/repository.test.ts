import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
describe("booking repository", () => {
  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    rpc.mockReset();
  });
  it("requires local server credentials", async () => {
    const { createBookingRepository } = await import("../../src/repository");
    expect(() => createBookingRepository()).toThrow("SUPABASE_URL");
  });
  it("returns RPC data and propagates errors", async () => {
    process.env.SUPABASE_URL = "http://local";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
    const { createBookingRepository } = await import("../../src/repository");
    rpc.mockResolvedValueOnce({ data: { result: "ok" }, error: null });
    await expect(
      createBookingRepository().call("fn", { p: 1 }),
    ).resolves.toEqual({ result: "ok" });
    rpc.mockResolvedValueOnce({ data: null, error: new Error("db") });
    await expect(createBookingRepository().call("fn", {})).rejects.toThrow(
      "db",
    );
  });
});
