import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const { redirectMock, revalidatePathMock, getUserFromSessionMock, createPermissionMock, updatePermissionMock, deletePermissionMock } =
  vi.hoisted(() => ({
    redirectMock: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
    revalidatePathMock: vi.fn(),
    getUserFromSessionMock: vi.fn(),
    createPermissionMock: vi.fn(),
    updatePermissionMock: vi.fn(),
    deletePermissionMock: vi.fn()
  }));

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
  createPermission: createPermissionMock,
  updatePermission: updatePermissionMock,
  deletePermission: deletePermissionMock
}));

import {
  createPermissionAction,
  deletePermissionAction,
  updatePermissionAction
} from "../../../../src/app/dashboard/permissions/actions";

describe("dashboard/permissions/actions", () => {
  function redirectPattern(pathWithoutNonce: string): RegExp {
    return new RegExp(`^REDIRECT:${pathWithoutNonce}(?:&r=[a-z0-9]+)?$`);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redireciona com forbidden quando usuario nao tem permissao de criacao", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.PERMISSION_READ] });

    const formData = new FormData();
    formData.set("name", "hotel_manage");
    formData.set("type", "SYSTEM_PERMISSION");

    await expect(createPermissionAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/permissions/view\\?status=forbidden")
    );
  });

  it("redireciona para create_missing_fields quando nome nao e informado", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.PERMISSION_CREATE] });

    const formData = new FormData();
    formData.set("name", "");
    formData.set("type", "SYSTEM_PERMISSION");

    await expect(createPermissionAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/permissions/create\\?status=create_missing_fields")
    );

    expect(createPermissionMock).not.toHaveBeenCalled();
  });

  it("cria permissao e redireciona com status created", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.PERMISSION_CREATE] });
    createPermissionMock.mockResolvedValueOnce({ id: "perm-1" });

    const formData = new FormData();
    formData.set("name", "hotel_manage");
    formData.set("type", "HOTEL_PERMISSION");

    await expect(createPermissionAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/permissions/create\\?status=created")
    );

    expect(createPermissionMock).toHaveBeenCalledWith({ name: "hotel_manage", type: "HOTEL_PERMISSION" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/permissions");
  });

  it("atualiza permissao e redireciona com status updated", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.PERMISSION_UPDATE] });
    updatePermissionMock.mockResolvedValueOnce({ id: "perm-1" });

    const formData = new FormData();
    formData.set("id", "perm-1");
    formData.set("name", "hotel_manage_all");
    formData.set("type", "HOTEL_PERMISSION");

    await expect(updatePermissionAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/permissions/view\\?status=updated")
    );

    expect(updatePermissionMock).toHaveBeenCalledWith("perm-1", { name: "hotel_manage_all", type: "HOTEL_PERMISSION" });
  });

  it("remove permissao e redireciona com status deleted", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.PERMISSION_DELETE] });
    deletePermissionMock.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.set("id", "perm-1");

    await expect(deletePermissionAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/permissions/view\\?status=deleted")
    );

    expect(deletePermissionMock).toHaveBeenCalledWith("perm-1");
  });

  it("redireciona com delete_conflict quando API sinaliza dependencias ativas", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.PERMISSION_DELETE] });
    deletePermissionMock.mockRejectedValueOnce(new Error("Permissao nao pode ser excluida: possui dependencias ativas."));

    const formData = new FormData();
    formData.set("id", "perm-1");

    await expect(deletePermissionAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/permissions/view\\?status=delete_conflict")
    );
  });
});