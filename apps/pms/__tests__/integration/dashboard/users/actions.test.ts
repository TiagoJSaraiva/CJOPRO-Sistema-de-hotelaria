import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const { redirectMock, revalidatePathMock, getUserFromSessionMock, createUserMock, updateUserMock, deleteUserMock } = vi.hoisted(
  () => ({
    redirectMock: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
    revalidatePathMock: vi.fn(),
    getUserFromSessionMock: vi.fn(),
    createUserMock: vi.fn(),
    updateUserMock: vi.fn(),
    deleteUserMock: vi.fn()
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
  createUser: createUserMock,
  updateUser: updateUserMock,
  deleteUser: deleteUserMock
}));

import { createUserAction, deleteUserAction, updateUserAction } from "../../../../src/app/dashboard/users/actions";

describe("dashboard/users/actions", () => {
  function redirectPattern(pathWithoutNonce: string): RegExp {
    return new RegExp(`^REDIRECT:${pathWithoutNonce}(?:&r=[a-z0-9]+)?$`);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redireciona com forbidden quando usuario nao tem permissao de criacao", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.USER_READ] });

    const formData = new FormData();
    formData.set("name", "Operador");
    formData.set("email", "op@hotel.com");
    formData.set("password_hash", "tmp123");

    await expect(createUserAction(formData)).rejects.toThrow(redirectPattern("/dashboard/users/view\\?status=forbidden"));
  });

  it("redireciona para create_missing_fields quando payload obrigatorio esta incompleto", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.USER_CREATE] });

    const formData = new FormData();
    formData.set("name", "");

    await expect(createUserAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/users/create\\?status=create_missing_fields")
    );

    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("cria usuario e redireciona com status created", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.USER_CREATE] });
    createUserMock.mockResolvedValueOnce({ id: "user-1" });

    const formData = new FormData();
    formData.set("name", "Operador");
    formData.set("email", " OP@HOTEL.COM ");
    formData.set("password_hash", "tmp123");
    formData.set("role_assignments", '[{"role_id":"role-1","hotel_id":"hotel-1"}]');

    await expect(createUserAction(formData)).rejects.toThrow(redirectPattern("/dashboard/users/create\\?status=created"));

    expect(createUserMock).toHaveBeenCalledWith({
      name: "Operador",
      email: "op@hotel.com",
      password_hash: "tmp123",
      role_assignments: [{ role_id: "role-1", hotel_id: "hotel-1" }]
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/users");
  });

  it("atualiza usuario e redireciona com status updated", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.USER_UPDATE] });
    updateUserMock.mockResolvedValueOnce({ id: "user-1" });

    const formData = new FormData();
    formData.set("id", "user-1");
    formData.set("name", "Operador Atualizado");
    formData.set("email", "new@hotel.com");
    formData.set("role_assignments", "[]");
    formData.set("is_active", "on");

    await expect(updateUserAction(formData)).rejects.toThrow(redirectPattern("/dashboard/users/view\\?status=updated"));

    expect(updateUserMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        name: "Operador Atualizado",
        email: "new@hotel.com",
        role_assignments: [],
        is_active: true
      })
    );
  });

  it("remove usuario e redireciona com status deleted", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.USER_DELETE] });
    deleteUserMock.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.set("id", "user-1");

    await expect(deleteUserAction(formData)).rejects.toThrow(redirectPattern("/dashboard/users/view\\?status=deleted"));
    expect(deleteUserMock).toHaveBeenCalledWith("user-1");
  });

  it("redireciona com delete_conflict quando API sinaliza dependencias ativas", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.USER_DELETE] });
    deleteUserMock.mockRejectedValueOnce(new Error("Usuario nao pode ser excluido: possui dependencias ativas."));

    const formData = new FormData();
    formData.set("id", "user-1");

    await expect(deleteUserAction(formData)).rejects.toThrow(redirectPattern("/dashboard/users/view\\?status=delete_conflict"));
  });
});