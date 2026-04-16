"use client";

import Link from "next/link";
import { useState } from "react";
import { ADMIN_ROLE_TYPES, type AdminHotelOption, type AdminPermissionOption, type AdminRole, type AdminRoleType } from "@hotel/shared";
import { deleteRoleAction, updateRoleAction } from "../actions";
import { RoleHotelPickerField } from "./RoleHotelPickerField";
import { RolePermissionAssignmentsField } from "./RolePermissionAssignmentsField";

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
    <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="mb-[0.2rem] mt-0">{roleItem.name}</h3>
          <p className="m-0 text-[#555]">
            {roleItem.role_type === ADMIN_ROLE_TYPES.SYSTEM ? "SYSTEM ROLE" : "HOTEL ROLE"} - {roleScopeLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canRead ? (
            <Link
              href={viewHref}
              scroll={false}
              className={`rounded-lg border border-[#2d6cdf] px-[0.65rem] py-[0.45rem] no-underline ${
                isViewing ? "bg-[#e9f0ff] text-[#1b4db3]" : "bg-white text-[#1b4db3]"
              }`}
            >
              Visualizar dados
            </Link>
          ) : null}

          {canUpdate && !isCurrentUserRole ? (
            <Link
              href={editHref}
              scroll={false}
              className={`rounded-lg border border-[#0f766e] px-[0.65rem] py-[0.45rem] no-underline ${
                isEditing ? "bg-[#ddf5f2] text-[#0a5f58]" : "bg-white text-[#0a5f58]"
              }`}
            >
              Editar dados
            </Link>
          ) : null}

          {canUpdate && isCurrentUserRole ? (
            <button
              type="button"
              disabled
              title="Voce nao pode editar uma role vinculada ao proprio usuario."
              className="cursor-not-allowed rounded-lg border border-[#b8dccc] bg-[#effaf5] px-[0.65rem] py-[0.45rem] text-[#4f8b75]"
            >
              Editar dados
            </button>
          ) : null}

          {canDelete && !isCurrentUserRole ? (
            <form action={deleteRoleAction}>
              <input type="hidden" name="id" value={roleItem.id} />
              <button
                type="submit"
                className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]"
              >
                Apagar dados
              </button>
            </form>
          ) : null}

          {canDelete && isCurrentUserRole ? (
            <button
              type="button"
              disabled
              title="Voce nao pode apagar uma role vinculada ao proprio usuario."
              className="cursor-not-allowed rounded-lg border border-[#f1a1a1] bg-[#fff6f6] px-[0.65rem] py-[0.45rem] text-[#b45353]"
            >
              Apagar dados
            </button>
          ) : null}
        </div>
      </div>

      {isViewing ? <RoleDataPreview roleItem={roleItem} /> : null}
      {isEditing && !isCurrentUserRole ? <RoleEditForm roleItem={roleItem} hotels={hotels} permissions={permissions} /> : null}
    </article>
  );
}
