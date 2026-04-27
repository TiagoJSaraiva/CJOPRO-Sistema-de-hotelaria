"use client";

import { type AdminHotelOption, type AdminRoleOption, type AdminUser } from "@hotel/shared";
import { deleteUserAction, updateUserAction } from "../actions";
import { SelfManagementDisabledActions } from "./SelfManagementDisabledActions";
import { UserRoleAssignmentsField } from "./UserRoleAssignmentsField";
import { formatUserRoleAssignmentLabel } from "./userRoleLabels";
import { DashboardEntityActionButtons } from "../../_components/DashboardEntityActionButtons";
import { DashboardEntityListItemFrame } from "../../_components/DashboardEntityListItemFrame";

type UserListItemProps = {
  userItem: AdminUser;
  hotels: AdminHotelOption[];
  roles: AdminRoleOption[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isCurrentUser: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

function UserDataPreview({ userItem }: { userItem: AdminUser }) {
  const createdAt = userItem.created_at ? new Date(userItem.created_at).toLocaleString("pt-BR") : "-";
  const lastLogin = userItem.last_login_at ? new Date(userItem.last_login_at).toLocaleString("pt-BR") : "-";

  return (
    <div className="mt-[0.85rem] grid gap-[0.7rem]">
      <p className="m-0">
        <strong>Status:</strong> {userItem.is_active ? "Ativo" : "Inativo"}
      </p>
      <p className="m-0">
        <strong>Criado em:</strong> {createdAt}
      </p>
      <p className="m-0">
        <strong>Ultimo acesso:</strong> {lastLogin}
      </p>

      <div>
        <strong>Papeis vinculados:</strong>
        {userItem.role_assignments.length ? (
          <ul className="mb-0 mt-[0.45rem] pl-[1.1rem]">
            {userItem.role_assignments.map((assignment) => (
              <li key={`${assignment.role_id}-${assignment.hotel_id || "global"}`}>
                {formatUserRoleAssignmentLabel(assignment)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-[0.35rem] text-[#626c79]">Sem papeis vinculados.</p>
        )}
      </div>
    </div>
  );
}

function UserEditForm({ userItem, hotels, roles }: { userItem: AdminUser; hotels: AdminHotelOption[]; roles: AdminRoleOption[] }) {
  return (
    <form action={updateUserAction} className="mt-[0.85rem] grid gap-[0.65rem]">
      <input type="hidden" name="id" value={userItem.id} />

      <div className="pms-field">
        <label htmlFor={`name-${userItem.id}`}>Nome</label>
        <input
          id={`name-${userItem.id}`}
          name="name"
          defaultValue={userItem.name}
          required
          className="pms-field-input"
        />
      </div>

      <div className="pms-field">
        <label htmlFor={`email-${userItem.id}`}>Email</label>
        <input
          id={`email-${userItem.id}`}
          name="email"
          type="email"
          defaultValue={userItem.email}
          required
          className="pms-field-input"
        />
      </div>

      <div className="pms-field">
        <label htmlFor={`password-${userItem.id}`}>Nova senha temporaria (opcional)</label>
        <input
          id={`password-${userItem.id}`}
          name="password_hash"
          type="password"
          minLength={6}
          className="pms-field-input"
        />
      </div>

      <UserRoleAssignmentsField hotels={hotels} roles={roles} defaultAssignments={userItem.role_assignments} />

      <label className="flex items-center gap-2">
        <input name="is_active" type="checkbox" defaultChecked={userItem.is_active} />
        <span>Usuario ativo</span>
      </label>

      <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
        Salvar alteracoes
      </button>
    </form>
  );
}

export function UserListItem({ userItem, hotels, roles, canRead, canUpdate, canDelete, isCurrentUser, isViewing, isEditing }: UserListItemProps) {
  const viewHref = `/dashboard/users/view?userId=${userItem.id}&mode=view`;
  const editHref = `/dashboard/users/view?userId=${userItem.id}&mode=edit`;
  const canEditThisUser = canUpdate && !isCurrentUser;
  const canDeleteThisUser = canDelete && !isCurrentUser;

  return (
    <DashboardEntityListItemFrame
      title={userItem.name}
      subtitle={userItem.email}
      actions={
        <>
          <DashboardEntityActionButtons
            canRead={canRead}
            canUpdate={canEditThisUser}
            canDelete={canDeleteThisUser}
            isViewing={isViewing}
            isEditing={isEditing}
            viewHref={viewHref}
            editHref={editHref}
            deleteId={userItem.id}
            deleteAction={deleteUserAction}
          />

          {isCurrentUser ? <SelfManagementDisabledActions showEdit={canUpdate} showDelete={canDelete} /> : null}
        </>
      }
    >
      {isViewing ? <UserDataPreview userItem={userItem} /> : null}
      {isEditing && canEditThisUser ? <UserEditForm userItem={userItem} hotels={hotels} roles={roles} /> : null}
    </DashboardEntityListItemFrame>
  );
}
