import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserFromSession: vi.fn(),
  getUsersReferenceData: vi.fn(),
  getRolesReferenceData: vi.fn(),
  listUsers: vi.fn(),
  listRoles: vi.fn(),
}));

vi.mock("../../../src/lib/auth", () => ({
  getUserFromSession: mocks.getUserFromSession,
}));
vi.mock("../../../src/lib/adminApi", () => ({
  getUsersReferenceData: mocks.getUsersReferenceData,
  getRolesReferenceData: mocks.getRolesReferenceData,
  listUsers: mocks.listUsers,
  listRoles: mocks.listRoles,
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { PERMISSIONS } from "@hotel/shared";
import CreateRolePage from "../../../src/app/dashboard/roles/create/page";
import RolesViewPage from "../../../src/app/dashboard/roles/view/page";
import CreateUserPage from "../../../src/app/dashboard/users/create/page";
import UsersViewPage from "../../../src/app/dashboard/users/view/page";

// Um formulário sem as opções de papel ou permissão, se salvo, gravaria a lista vazia. Falhar a consulta
// precisa aparecer como erro de tela, não como um cadastro sem opções.
describe("telas de usuários e papéis sem dados de referência", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUserFromSession.mockResolvedValue({
      id: "user",
      permissions: Object.values(PERMISSIONS),
      roles: ["super_admin"],
      is_system_admin: true,
    });
    mocks.listUsers.mockResolvedValue([]);
    mocks.listRoles.mockResolvedValue([]);
    mocks.getUsersReferenceData.mockRejectedValue(new Error("indisponível"));
    mocks.getRolesReferenceData.mockRejectedValue(new Error("indisponível"));
  });

  it.each([
    ["criar usuário", CreateUserPage],
    ["ver usuários", UsersViewPage],
    ["criar papel", CreateRolePage],
    ["ver papéis", RolesViewPage],
  ])("%s mostra o erro", async (_name, Page) => {
    await expect(Page({})).rejects.toThrow("indisponível");
  });
});
