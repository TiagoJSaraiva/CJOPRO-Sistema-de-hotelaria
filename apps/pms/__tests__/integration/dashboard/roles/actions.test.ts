import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@hotel/shared";

const { redirectMock, revalidatePathMock, getUserFromSessionMock, createRoleMock, updateRoleMock, deleteRoleMock } = vi.hoisted(
  () => ({
    redirectMock: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    }),
    revalidatePathMock: vi.fn(),
    getUserFromSessionMock: vi.fn(),
    createRoleMock: vi.fn(),
    updateRoleMock: vi.fn(),
    deleteRoleMock: vi.fn()
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
  createRole: createRoleMock,
  updateRole: updateRoleMock,
  deleteRole: deleteRoleMock
}));

import { createRoleAction, deleteRoleAction, updateRoleAction } from "../../../../src/app/dashboard/roles/actions";

describe("dashboard/roles/actions", () => {
  function redirectPattern(pathWithoutNonce: string): RegExp {
    return new RegExp(`^REDIRECT:${pathWithoutNonce}(?:&r=[a-z0-9]+)?$`);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redireciona com forbidden quando usuario nao tem permissao de criacao", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.ROLE_READ] });

    const formData = new FormData();
    formData.set("name", "Supervisor");
    formData.set("role_type", "SYSTEM_ROLE");

    await expect(createRoleAction(formData)).rejects.toThrow(redirectPattern("/dashboard/roles/view\\?status=forbidden"));
  });

  it("redireciona para create_missing_fields quando nome nao e informado", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.ROLE_CREATE] });

    const formData = new FormData();
    formData.set("name", "");
    formData.set("role_type", "SYSTEM_ROLE");

    await expect(createRoleAction(formData)).rejects.toThrow(
      redirectPattern("/dashboard/roles/create\\?status=create_missing_fields")
    );

    expect(createRoleMock).not.toHaveBeenCalled();
  });

  it("cria role e redireciona com status created", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.ROLE_CREATE] });
    createRoleMock.mockResolvedValueOnce({ id: "role-1" });

    const formData = new FormData();
    formData.set("name", "Supervisor");
    formData.set("role_type", "HOTEL_ROLE");
    formData.set("hotel_id", "hotel-1");
    formData.set("permission_ids", '["perm-1", "perm-1", "perm-2"]');

    await expect(createRoleAction(formData)).rejects.toThrow(redirectPattern("/dashboard/roles/create\\?status=created"));

    expect(createRoleMock).toHaveBeenCalledWith({
      name: "Supervisor",
      role_type: "HOTEL_ROLE",
      hotel_id: "hotel-1",
      permission_ids: ["perm-1", "perm-2"]
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/roles");
  });

  it("atualiza role e redireciona com status updated", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.ROLE_UPDATE] });
    updateRoleMock.mockResolvedValueOnce({ id: "role-1" });

    const formData = new FormData();
    formData.set("id", "role-1");
    formData.set("name", "Supervisor Senior");
    formData.set("role_type", "SYSTEM_ROLE");
    formData.set("hotel_id", "");
    formData.set("permission_ids", '["perm-3"]');

    await expect(updateRoleAction(formData)).rejects.toThrow(redirectPattern("/dashboard/roles/view\\?status=updated"));

    expect(updateRoleMock).toHaveBeenCalledWith("role-1", {
      name: "Supervisor Senior",
      role_type: "SYSTEM_ROLE",
      hotel_id: null,
      permission_ids: ["perm-3"]
    });
  });

  it("remove role e redireciona com status deleted", async () => {
    getUserFromSessionMock.mockResolvedValueOnce({ permissions: [PERMISSIONS.ROLE_DELETE] });
    deleteRoleMock.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.set("id", "role-1");

    await expect(deleteRoleAction(formData)).rejects.toThrow(redirectPattern("/dashboard/roles/view\\?status=deleted"));
    expect(deleteRoleMock).toHaveBeenCalledWith("role-1");
  });
});