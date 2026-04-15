import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  redirectMock,
  clearSessionCookieMock,
  clearActiveHotelCookieMock,
  getUserFromSessionMock,
  decodeActiveHotelCookieMock,
  getActiveHotelCookieValueMock,
  userCanAccessHotelMock,
  resolveActiveHotelForUserMock,
  saveActiveHotelCookieMock
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  clearSessionCookieMock: vi.fn(),
  clearActiveHotelCookieMock: vi.fn(),
  getUserFromSessionMock: vi.fn(),
  decodeActiveHotelCookieMock: vi.fn(),
  getActiveHotelCookieValueMock: vi.fn(),
  userCanAccessHotelMock: vi.fn(),
  resolveActiveHotelForUserMock: vi.fn(),
  saveActiveHotelCookieMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("../../../src/lib/auth", () => ({
  clearSessionCookie: clearSessionCookieMock,
  getUserFromSession: getUserFromSessionMock
}));

vi.mock("../../../src/lib/activeHotel", () => ({
  decodeActiveHotelCookie: decodeActiveHotelCookieMock,
  getActiveHotelCookieValue: getActiveHotelCookieValueMock,
  userCanAccessHotel: userCanAccessHotelMock,
  resolveActiveHotelForUser: resolveActiveHotelForUserMock,
  saveActiveHotelCookie: saveActiveHotelCookieMock,
  clearActiveHotelCookie: clearActiveHotelCookieMock
}));

import { logoutAction, setActiveHotelAction } from "../../../src/app/dashboard/actions";

describe("dashboard/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("setActiveHotelAction limpa cookie quando sessao e invalida", async () => {
    getUserFromSessionMock.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.set("hotelId", "hotel-1");

    await setActiveHotelAction(formData);

    expect(clearActiveHotelCookieMock).toHaveBeenCalled();
    expect(saveActiveHotelCookieMock).not.toHaveBeenCalled();
  });

  it("setActiveHotelAction salva hotel escolhido quando usuario possui acesso", async () => {
    const user = { roleAssignments: [{ hotelId: "hotel-1" }] };
    getUserFromSessionMock.mockResolvedValueOnce(user);
    decodeActiveHotelCookieMock.mockReturnValueOnce("hotel-1");
    userCanAccessHotelMock.mockReturnValueOnce(true);
    resolveActiveHotelForUserMock.mockReturnValueOnce("hotel-1");

    const formData = new FormData();
    formData.set("hotelId", "hotel-1");

    await setActiveHotelAction(formData);

    expect(saveActiveHotelCookieMock).toHaveBeenCalledWith("hotel-1");
  });

  it("setActiveHotelAction usa preferencia atual quando escolha recebida e invalida", async () => {
    const user = { roleAssignments: [{ hotelId: "hotel-1" }] };
    getUserFromSessionMock.mockResolvedValueOnce(user);
    decodeActiveHotelCookieMock.mockReturnValueOnce("hotel-999");
    userCanAccessHotelMock.mockReturnValueOnce(false);
    getActiveHotelCookieValueMock.mockReturnValueOnce("hotel-1");
    resolveActiveHotelForUserMock.mockReturnValueOnce("hotel-1");

    const formData = new FormData();
    formData.set("hotelId", "hotel-999");

    await setActiveHotelAction(formData);

    expect(resolveActiveHotelForUserMock).toHaveBeenCalledWith(user, "hotel-1");
    expect(saveActiveHotelCookieMock).toHaveBeenCalledWith("hotel-1");
  });

  it("logoutAction limpa cookies e redireciona para login", async () => {
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");

    expect(clearActiveHotelCookieMock).toHaveBeenCalled();
    expect(clearSessionCookieMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
