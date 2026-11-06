import { beforeEach, describe, expect, it, vi } from "vitest";

const getHotelClock = vi.hoisted(() => vi.fn());
vi.mock("../../../src/lib/adminApi", () => ({ getHotelClock }));

import { DEFAULT_DISPLAY_TIME_ZONE } from "@hotel/shared";
import { resolveHotelTimeZone } from "../../../src/lib/hotelClock";

beforeEach(() => {
  getHotelClock.mockReset();
});

describe("resolveHotelTimeZone", () => {
  it("usa o fuso do hotel ativo", async () => {
    getHotelClock.mockResolvedValue({ timezone: "Asia/Tokyo" });
    await expect(resolveHotelTimeZone("hotel-1")).resolves.toBe("Asia/Tokyo");
  });

  it("no escopo global, sem hotel ativo, usa o fuso padrão sem consultar o relógio", async () => {
    await expect(resolveHotelTimeZone(null)).resolves.toBe(
      DEFAULT_DISPLAY_TIME_ZONE,
    );
    expect(getHotelClock).not.toHaveBeenCalled();
  });

  it("falha do relógio não derruba o painel nem assume outro fuso", async () => {
    getHotelClock.mockRejectedValue(new Error("Falha"));
    await expect(resolveHotelTimeZone("hotel-1")).resolves.toBeNull();
  });
});
