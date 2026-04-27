"use client";

import { useState } from "react";
import { ADMIN_ROLE_TYPES, type AdminHotelOption, type AdminPermissionOption, type AdminRole, type AdminRoleType } from "@hotel/shared";
import { deleteRoleAction, updateRoleAction } from "../actions";
import { RoleHotelPickerField } from "./RoleHotelPickerField";
import { RolePermissionAssignmentsField } from "./RolePermissionAssignmentsField";
import { DashboardEntityActionButtons } from "../../_components/DashboardEntityActionButtons";
import { DashboardEntityListItemFrame } from "../../_components/DashboardEntityListItemFrame";

type RoleListItemProps = {
  roleItem: AdminRole;
  hotels: AdminHotelOption[];
  permissions: AdminPermissionOption[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isCurrentUserRole: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

function RoleDataPreview({ roleItem }: { roleItem: AdminRole }) {
  const scopeLabel =
    roleItem.role_type === ADMIN_ROLE_TYPES.SYSTEM
      ? "Sistema"
      : roleItem.hotel_name
        ? `Hotel especifico: ${roleItem.hotel_name}`
        : "Generica (qualquer hotel)";

  return (
    <div className="mt-[0.85rem] grid gap-[0.7rem]">
      <p className="m-0">
        <strong>Tipo da role:</strong> {roleItem.role_type === ADMIN_ROLE_TYPES.SYSTEM ? "SYSTEM ROLE" : "HOTEL ROLE"}
      </p>
      <p className="m-0">
        <strong>Escopo:</strong> {scopeLabel}
      </p>

      <div>
        <strong>Permissoes vinculadas:</strong>
        {roleItem.permissions.length ? (
          <ul className="mb-0 mt-[0.45rem] pl-[1.1rem]">
            {roleItem.permissions.map((permission) => (
              <li key={permission.id}>{permission.name}</li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-[0.35rem] text-[#626c79]">Sem permissoes vinculadas.</p>
        )}
      </div>
    </div>
  );
}

function RoleEditForm({ roleItem, hotels, permissions }: { roleItem: AdminRole; hotels: AdminHotelOption[]; permissions: AdminPermissionOption[] }) {
  const [roleType, setRoleType] = useState<AdminRoleType>(roleItem.role_type);

  return (
    <form action={updateRoleAction} className="mt-[0.85rem] grid gap-[0.65rem]">
      <input type="hidden" name="id" value={roleItem.id} />

      <div className="pms-field">
        <label htmlFor={`name-${roleItem.id}`}>Nome</label>
        <input
          id={`name-${roleItem.id}`}
          name="name"
          defaultValue={roleItem.name}
          required
          className="pms-field-input"
        />
      </div>

      <div className="pms-field">
        <label htmlFor={`role-type-${roleItem.id}`}>Tipo da role</label>
        <select
          id={`role-type-${roleItem.id}`}
          name="role_type"
          value={roleType}
          onChange={(event) => setRoleType(event.target.value as AdminRoleType)}
          className="pms-field-input"
        >
          <option value={ADMIN_ROLE_TYPES.SYSTEM}>SYSTEM ROLE</option>
          <option value={ADMIN_ROLE_TYPES.HOTEL}>HOTEL ROLE</option>
        </select>
      </div>

      <RoleHotelPickerField hotels={hotels} roleType={roleType} defaultHotelId={roleItem.hotel_id} />
      <RolePermissionAssignmentsField roleType={roleType} permissions={permissions} defaultPermissions={roleItem.permissions} />

      <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
        Salvar alteracoes
      </button>
    </form>
  );
}

export function RoleListItem({ roleItem, hotels, permissions, canRead, canUpdate, canDelete, isCurrentUserRole, isViewing, isEditing }: RoleListItemProps) {
  const viewHref = `/dashboard/roles/view?roleId=${roleItem.id}&mode=view`;
  const editHref = `/dashboard/roles/view?roleId=${roleItem.id}&mode=edit`;
  const roleScopeLabel =
    roleItem.role_type === ADMIN_ROLE_TYPES.SYSTEM
      ? "Sistema"
      : roleItem.hotel_name
        ? roleItem.hotel_name
        : "Generica";

  return (
    <DashboardEntityListItemFrame
      title={roleItem.name}
      subtitle={`${roleItem.role_type === ADMIN_ROLE_TYPES.SYSTEM ? "SYSTEM ROLE" : "HOTEL ROLE"} - ${roleScopeLabel}`}
      actions={
        <DashboardEntityActionButtons
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={isViewing}
          isEditing={isEditing}
          viewHref={viewHref}
          editHref={editHref}
          deleteId={roleItem.id}
          deleteAction={deleteRoleAction}
          editDisabled={isCurrentUserRole}
          editDisabledTitle="Voce nao pode editar uma role vinculada ao proprio usuario."
          deleteDisabled={isCurrentUserRole}
          deleteDisabledTitle="Voce nao pode apagar uma role vinculada ao proprio usuario."
        />
      }
    >
      {isViewing ? <RoleDataPreview roleItem={roleItem} /> : null}
      {isEditing && !isCurrentUserRole ? <RoleEditForm roleItem={roleItem} hotels={hotels} permissions={permissions} /> : null}
    </DashboardEntityListItemFrame>
  );
}
