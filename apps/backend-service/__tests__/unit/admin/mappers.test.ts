import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@hotel/shared";
import {
  mapAdminRole,
  mapAdminUser,
  mapAuthUserFromDb,
  mapRoleOption,
  normalizePermissionIds,
  normalizeRoleAssignments
} from "../../../src/admin/mappers";

describe("admin/mappers", () => {
  it("mapAuthUserFromDb agrega roles, permissoes validas e role assignments", () => {
    const result = mapAuthUserFromDb({
      id: "user-1",
      name: "Admin",
      email: "admin@example.com",
      user_roles: [
        {
          hotel_id: "hotel-fallback",
          roles: {
            id: "role-1",
            name: "Administrador",
            role_type: "SYSTEM_ROLE",
            hotel_id: null,
            hotels: { name: null },
            role_permissions: [
              { permissions: { name: PERMISSIONS.USER_READ } },
              { permissions: { name: "invalid_permission" } }
            ]
          }
        },
        {
          roles: {
            id: "role-2",
            name: "Gestor",
            role_type: "HOTEL_ROLE",
            hotel_id: "hotel-2",
            hotels: { name: "Hotel Azul" },
            role_permissions: [{ permissions: { name: PERMISSIONS.USER_UPDATE } }]
          }
        }
      ]
    });

    expect(result).toEqual({
      id: "user-1",
      name: "Admin",
      email: "admin@example.com",
      tenantId: null,
      roles: ["Administrador", "Gestor"],
      permissions: [PERMISSIONS.USER_READ, PERMISSIONS.USER_UPDATE],
      roleAssignments: [
        {
          roleId: "role-1",
          roleName: "Administrador",
          roleType: "SYSTEM_ROLE",
          hotelId: "hotel-fallback",
          hotelName: null
        },
        {
          roleId: "role-2",
          roleName: "Gestor",
          roleType: "HOTEL_ROLE",
          hotelId: "hotel-2",
          hotelName: "Hotel Azul"
        }
      ]
    });
  });

  it("normalizeRoleAssignments remove duplicidades e invalores", () => {
    const result = normalizeRoleAssignments([
      { role_id: " role-1 ", hotel_id: " hotel-1 " },
      { role_id: "role-1", hotel_id: "hotel-1" },
      { role_id: "role-1", hotel_id: "hotel-2" },
      { role_id: "", hotel_id: "hotel-2" },
      { role_id: "role-2", hotel_id: "" }
    ]);

    expect(result).toEqual([
      { role_id: "role-1", hotel_id: "hotel-1" },
      { role_id: "role-1", hotel_id: "hotel-2" },
      { role_id: "role-2", hotel_id: null }
    ]);
  });

  it("normalizePermissionIds remove duplicidades e valores vazios", () => {
    const result = normalizePermissionIds([" perm-1 ", "perm-1", "", null, "perm-2"]);

    expect(result).toEqual(["perm-1", "perm-2"]);
  });

  it("mapRoleOption retorna opcao de role com hotel opcional", () => {
    const result = mapRoleOption({
      id: "role-1",
      name: "Operador",
      role_type: "HOTEL_ROLE",
      hotel_id: "hotel-1",
      hotels: { name: "Hotel Verde" }
    });

    expect(result).toEqual({
      id: "role-1",
      name: "Operador",
      role_type: "HOTEL_ROLE",
      hotel_id: "hotel-1",
      hotel_name: "Hotel Verde"
    });
  });

  it("mapAdminUser filtra assignments sem role valido", () => {
    const result = mapAdminUser({
      id: "user-1",
      name: "Admin",
      email: "admin@example.com",
      is_active: 1,
      last_login_at: null,
      created_at: "2025-01-01T00:00:00.000Z",
      user_roles: [
        { roles: { id: "role-1", name: "Gestor", role_type: "SYSTEM_ROLE", hotel_id: null, hotels: { name: null } } },
        { roles: null }
      ]
    });

    expect(result).toEqual({
      id: "user-1",
      name: "Admin",
      email: "admin@example.com",
      is_active: true,
      last_login_at: null,
      created_at: "2025-01-01T00:00:00.000Z",
      role_assignments: [
        {
          role_id: "role-1",
          role_name: "Gestor",
          role_type: "SYSTEM_ROLE",
          hotel_id: null,
          hotel_name: null
        }
      ]
    });
  });

  it("mapAdminRole retorna role com permissoes validas", () => {
    const result = mapAdminRole({
      id: "role-1",
      name: "Gestor",
      role_type: "HOTEL_ROLE",
      hotel_id: "hotel-1",
      hotels: { name: "Hotel Central" },
      role_permissions: [
        { permissions: { id: "perm-1", name: "user_read", type: "HOTEL_PERMISSION" } },
        { permissions: { id: null, name: "invalid" } }
      ]
    });

    expect(result).toEqual({
      id: "role-1",
      name: "Gestor",
      role_type: "HOTEL_ROLE",
      hotel_id: "hotel-1",
      hotel_name: "Hotel Central",
      permissions: [{ id: "perm-1", name: "user_read", type: "HOTEL_PERMISSION" }]
    });
  });
});