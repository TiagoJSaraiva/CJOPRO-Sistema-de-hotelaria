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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redireciona com forbidden quando usuario nao tem permissao de criacao", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.PERMISSION_READ] });

    const formData = new FormData();
    formData.set("name", "hotel_manage");

    await expect(createPermissionAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/permissions/view?status=forbidden"
    );
  });

  it("redireciona para create_missing_fields quando nome nao e informado", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.PERMISSION_CREATE] });

    const formData = new FormData();
    formData.set("name", "");

    await expect(createPermissionAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/permissions/create?status=create_missing_fields"
    );

    expect(createPermissionMock).not.toHaveBeenCalled();
  });

  it("cria permissao e redireciona com status created", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.PERMISSION_CREATE] });
    createPermissionMock.mockResolvedValueOnce({ id: "perm-1" });

    const formData = new FormData();
    formData.set("name", "hotel_manage");

    await expect(createPermissionAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/permissions/create?status=created"
    );

    expect(createPermissionMock).toHaveBeenCalledWith({ name: "hotel_manage" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/permissions");
  });

  it("atualiza permissao e redireciona com status updated", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.PERMISSION_UPDATE] });
    updatePermissionMock.mockResolvedValueOnce({ id: "perm-1" });

    const formData = new FormData();
    formData.set("id", "perm-1");
    formData.set("name", "hotel_manage_all");

    await expect(updatePermissionAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/permissions/view?status=updated"
    );

    expect(updatePermissionMock).toHaveBeenCalledWith("perm-1", { name: "hotel_manage_all" });
  });

  it("remove permissao e redireciona com status deleted", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.PERMISSION_DELETE] });
    deletePermissionMock.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.set("id", "perm-1");

    await expect(deletePermissionAction(formData)).rejects.toThrow(
      "REDIRECT:/dashboard/permissions/view?status=deleted"
    );

    expect(deletePermissionMock).toHaveBeenCalledWith("perm-1");
  });
});