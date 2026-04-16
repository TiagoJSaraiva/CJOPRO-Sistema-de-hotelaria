"use client";

import Link from "next/link";
import { ADMIN_PERMISSION_TYPES, type AdminPermission } from "@hotel/shared";
import { deletePermissionAction, updatePermissionAction } from "../actions";

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
    <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="mb-[0.2rem] mt-0">{permissionItem.name}</h3>
          <p className="m-0 text-[#555]">Tipo: {permissionItem.type === ADMIN_PERMISSION_TYPES.SYSTEM ? "SYSTEM" : "HOTEL"}</p>
          <p className="m-0 text-[#555]">ID: {permissionItem.id}</p>
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

          {canUpdate && !isCurrentUserPermission ? (
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

          {canUpdate && isCurrentUserPermission ? (
            <button
              type="button"
              disabled
              title="Voce nao pode editar uma permissao vinculada ao proprio usuario."
              className="cursor-not-allowed rounded-lg border border-[#b8dccc] bg-[#effaf5] px-[0.65rem] py-[0.45rem] text-[#4f8b75]"
            >
              Editar dados
            </button>
          ) : null}

          {canDelete && !isCurrentUserPermission ? (
            <form action={deletePermissionAction}>
              <input type="hidden" name="id" value={permissionItem.id} />
              <button
                type="submit"
                className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]"
              >
                Apagar dados
              </button>
            </form>
          ) : null}

          {canDelete && isCurrentUserPermission ? (
            <button
              type="button"
              disabled
              title="Voce nao pode apagar uma permissao vinculada ao proprio usuario."
              className="cursor-not-allowed rounded-lg border border-[#f1a1a1] bg-[#fff6f6] px-[0.65rem] py-[0.45rem] text-[#b45353]"
            >
              Apagar dados
            </button>
          ) : null}
        </div>
      </div>

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
    </article>
  );
}
