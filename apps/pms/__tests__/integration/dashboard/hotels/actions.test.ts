import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const { redirectMock, revalidatePathMock, getUserFromSessionMock, createHotelMock, updateHotelMock, deleteHotelMock } = vi.hoisted(
  () => ({
    redirectMock: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
    revalidatePathMock: vi.fn(),
    getUserFromSessionMock: vi.fn(),
    createHotelMock: vi.fn(),
    updateHotelMock: vi.fn(),
    deleteHotelMock: vi.fn()
  })
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

vi.mock("../../../../src/lib/auth", () => ({
  getUserFromSession: getUserFromSessionMock
}));

vi.mock("../../../../src/lib/adminApi", () => ({
  createHotel: createHotelMock,
  updateHotel: updateHotelMock,
  deleteHotel: deleteHotelMock
}));

import { createHotelAction, deleteHotelAction, updateHotelAction } from "../../../../src/app/dashboard/hotels/actions";

function buildCreateFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();

  formData.set("name", "Hotel Centro");
  formData.set("legal_name", "Hotel Centro LTDA");
  formData.set("tax_id", "04.252.011/0001-10");
  formData.set("slug", " Hotel Centro ");
  formData.set("email", "ADMIN@HOTEL.COM");
  formData.set("phone", "+55 (11) 99888-7766");
  formData.set("address_line", "Rua A");
  formData.set("address_number", "100");
  formData.set("district", "Centro");
  formData.set("city", "Sao Paulo");
  formData.set("state", "SP");
  formData.set("country", "br");
  formData.set("zip_code", "01001-000");
  formData.set("timezone", "America/Sao_Paulo");
  formData.set("currency", "brl");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

describe("dashboard/hotels/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redireciona com forbidden quando usuario nao autenticado", async () => {
    getUserFromSessionMock.mockResolvedValueOnce(null);

    await expect(createHotelAction(buildCreateFormData())).rejects.toThrow("REDIRECT:/dashboard/hotels?status=forbidden");
    expect(createHotelMock).not.toHaveBeenCalled();
  });

  it("redireciona para view quando usuario so tem permissao de leitura", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({
      permissions: [PERMISSIONS.HOTEL_READ]
    });

    await expect(createHotelAction(buildCreateFormData())).rejects.toThrow(
      "REDIRECT:/dashboard/hotels/view?status=forbidden"
    );
  });

  it("redireciona para create_missing_fields quando payload obrigatorio esta incompleto", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({
      permissions: [PERMISSIONS.HOTEL_CREATE]
    });

    await expect(createHotelAction(buildCreateFormData({ name: "" }))).rejects.toThrow(
      "REDIRECT:/dashboard/hotels/create?status=create_missing_fields"
    );

    expect(createHotelMock).not.toHaveBeenCalled();
  });

  it("cria hotel, revalida paginas e redireciona com status created", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({
      permissions: [PERMISSIONS.HOTEL_CREATE]
    });
    createHotelMock.mockResolvedValueOnce({ id: "hotel-1" });

    await expect(createHotelAction(buildCreateFormData())).rejects.toThrow(
      "REDIRECT:/dashboard/hotels/create?status=created"
    );

    expect(createHotelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Hotel Centro",
        legal_name: "Hotel Centro LTDA",
        tax_id: "04252011000110",
        slug: "hotel-centro",
        email: "admin@hotel.com",
        phone: "5511998887766",
        country: "BR",
        currency: "BRL"
      })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/hotels");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/hotels/create");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/hotels/view");
  });

  it("atualiza hotel e redireciona para updated", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({
      permissions: [PERMISSIONS.HOTEL_UPDATE]
    });
    updateHotelMock.mockResolvedValueOnce({ id: "hotel-1" });

    const formData = new FormData();
    formData.set("id", "hotel-1");
    formData.set("name", "Hotel Atualizado");
    formData.set("slug", "Hotel Atualizado");
    formData.set("city", "Campinas");
    formData.set("email", "MANAGER@HOTEL.COM");
    formData.set("is_active", "on");

    await expect(updateHotelAction(formData)).rejects.toThrow("REDIRECT:/dashboard/hotels/view?status=updated");

    expect(updateHotelMock).toHaveBeenCalledWith(
      "hotel-1",
      expect.objectContaining({
        name: "Hotel Atualizado",
        slug: "hotel-atualizado",
        city: "Campinas",
        email: "manager@hotel.com",
        is_active: true
      })
    );
  });

  it("remove hotel e redireciona para deleted", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({
      permissions: [PERMISSIONS.HOTEL_DELETE]
    });
    deleteHotelMock.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.set("id", "hotel-1");

    await expect(deleteHotelAction(formData)).rejects.toThrow("REDIRECT:/dashboard/hotels/view?status=deleted");

    expect(deleteHotelMock).toHaveBeenCalledWith("hotel-1");
  });
});