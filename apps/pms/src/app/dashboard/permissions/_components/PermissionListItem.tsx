"use client";

import { ADMIN_PERMISSION_TYPES, type AdminPermission } from "@hotel/shared";
import { deletePermissionAction, updatePermissionAction } from "../actions";
import { DashboardEntityActionButtons } from "../../_components/DashboardEntityActionButtons";
import { DashboardEntityListItemFrame } from "../../_components/DashboardEntityListItemFrame";

type PermissionListItemProps = {
  permissionItem: AdminPermission;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isCurrentUserPermission: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

function PermissionEditForm({ permissionItem }: { permissionItem: AdminPermission }) {
  return (
    <form action={updatePermissionAction} className="mt-[0.85rem] grid gap-[0.65rem]">
      <input type="hidden" name="id" value={permissionItem.id} />

      <div className="pms-field">
        <label htmlFor={`permission-name-${permissionItem.id}`}>Nome</label>
        <input
          id={`permission-name-${permissionItem.id}`}
          name="name"
          defaultValue={permissionItem.name}
          required
          className="pms-field-input"
        />
      </div>

      <div className="pms-field">
        <label htmlFor={`permission-type-${permissionItem.id}`}>Tipo</label>
        <select
          id={`permission-type-${permissionItem.id}`}
          name="type"
          defaultValue={permissionItem.type}
          className="pms-field-input"
        >
          <option value={ADMIN_PERMISSION_TYPES.SYSTEM}>SYSTEM PERMISSION</option>
          <option value={ADMIN_PERMISSION_TYPES.HOTEL}>HOTEL PERMISSION</option>
        </select>
      </div>

      <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
        Salvar alteracoes
      </button>
    </form>
  );
}

export function PermissionListItem({ permissionItem, canRead, canUpdate, canDelete, isCurrentUserPermission, isViewing, isEditing }: PermissionListItemProps) {
  const viewHref = `/dashboard/permissions/view?permissionId=${permissionItem.id}&mode=view`;
  const editHref = `/dashboard/permissions/view?permissionId=${permissionItem.id}&mode=edit`;

  return (
    <DashboardEntityListItemFrame
      title={permissionItem.name}
      subtitle={`Tipo: ${permissionItem.type === ADMIN_PERMISSION_TYPES.SYSTEM ? "SYSTEM" : "HOTEL"} | ID: ${permissionItem.id}`}
      actions={
        <DashboardEntityActionButtons
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={isViewing}
          isEditing={isEditing}
          viewHref={viewHref}
          editHref={editHref}
          deleteId={permissionItem.id}
          deleteAction={deletePermissionAction}
          editDisabled={isCurrentUserPermission}
          editDisabledTitle="Voce nao pode editar uma permissao vinculada ao proprio usuario."
          deleteDisabled={isCurrentUserPermission}
          deleteDisabledTitle="Voce nao pode apagar uma permissao vinculada ao proprio usuario."
        />
      }
    >
      {isViewing ? (
        <div className="mt-[0.8rem]">
          <p className="m-0">
            <strong>Nome:</strong> {permissionItem.name}
          </p>
          <p className="m-0 mt-[0.35rem]">
            <strong>Tipo:</strong> {permissionItem.type === ADMIN_PERMISSION_TYPES.SYSTEM ? "SYSTEM PERMISSION" : "HOTEL PERMISSION"}
          </p>
        </div>
      ) : null}

      {isEditing && !isCurrentUserPermission ? <PermissionEditForm permissionItem={permissionItem} /> : null}
    </DashboardEntityListItemFrame>
  );
}
