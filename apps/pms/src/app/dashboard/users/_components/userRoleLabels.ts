import { ADMIN_ROLE_TYPES, type AdminRoleOption, type AdminUserRoleAssignment } from "@hotel/shared";

export function formatUserRoleAssignmentLabel(
  assignment: Pick<AdminUserRoleAssignment, "role_name" | "role_type" | "hotel_name" | "role_hotel_id" | "role_hotel_name">
): string {
  if (assignment.role_type === ADMIN_ROLE_TYPES.SYSTEM) {
    return `Sistema - ${assignment.role_name}`;
  }

  const hotelLabel = assignment.role_hotel_id ? assignment.role_hotel_name || assignment.hotel_name || "Hotel" : assignment.hotel_name || assignment.role_hotel_name || "Hotel";
  const genericSuffix = assignment.role_hotel_id ? "" : " (Genérico)";

  return `${hotelLabel} - ${assignment.role_name}${genericSuffix}`;
}

export function formatRoleOptionLabel(role: AdminRoleOption, selectedContextLabel?: string): string {
  if (role.role_type === ADMIN_ROLE_TYPES.SYSTEM) {
    return `${role.name} (SYSTEM ROLE)`;
  }

  if (role.hotel_id) {
    return `${role.name} (${role.hotel_name || selectedContextLabel || "Hotel"})`;
  }

  return `${role.name} (GENERICA)`;
}