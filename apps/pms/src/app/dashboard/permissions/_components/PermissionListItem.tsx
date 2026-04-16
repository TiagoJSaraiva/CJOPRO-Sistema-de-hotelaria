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
    <form action={updatePermissionAction} style={{ display: "grid", gap: "0.65rem", marginTop: "0.85rem" }}>
      <input type="hidden" name="id" value={permissionItem.id} />

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor={`permission-name-${permissionItem.id}`}>Nome</label>
        <input
          id={`permission-name-${permissionItem.id}`}
          name="name"
          defaultValue={permissionItem.name}
          required
          style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
        />
      </div>

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor={`permission-type-${permissionItem.id}`}>Tipo</label>
        <select
          id={`permission-type-${permissionItem.id}`}
          name="type"
          defaultValue={permissionItem.type}
          style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
        >
          <option value={ADMIN_PERMISSION_TYPES.SYSTEM}>SYSTEM PERMISSION</option>
          <option value={ADMIN_PERMISSION_TYPES.HOTEL}>HOTEL PERMISSION</option>
        </select>
      </div>

      <button
        type="submit"
        style={{ border: 0, background: "#1c6d4e", color: "#fff", borderRadius: "8px", padding: "0.55rem 0.75rem", cursor: "pointer", justifySelf: "start" }}
      >
        Salvar alteracoes
      </button>
    </form>
  );
}

export function PermissionListItem({ permissionItem, canRead, canUpdate, canDelete, isCurrentUserPermission, isViewing, isEditing }: PermissionListItemProps) {
  const viewHref = `/dashboard/permissions/view?permissionId=${permissionItem.id}&mode=view`;
  const editHref = `/dashboard/permissions/view?permissionId=${permissionItem.id}&mode=edit`;

  return (
    <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "0.95rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: "0.2rem" }}>{permissionItem.name}</h3>
          <p style={{ margin: 0, color: "#555" }}>Tipo: {permissionItem.type === ADMIN_PERMISSION_TYPES.SYSTEM ? "SYSTEM" : "HOTEL"}</p>
          <p style={{ margin: 0, color: "#555" }}>ID: {permissionItem.id}</p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {canRead ? (
            <Link
              href={viewHref}
              scroll={false}
              style={{
                textDecoration: "none",
                border: "1px solid #2d6cdf",
                color: "#1b4db3",
                background: isViewing ? "#e9f0ff" : "#fff",
                borderRadius: "8px",
                padding: "0.45rem 0.65rem"
              }}
            >
              Visualizar dados
            </Link>
          ) : null}

          {canUpdate ? (
            <Link
              href={editHref}
              scroll={false}
              style={{
                textDecoration: "none",
                border: "1px solid #0f766e",
                color: "#0a5f58",
                background: isEditing ? "#ddf5f2" : "#fff",
                borderRadius: "8px",
                padding: "0.45rem 0.65rem"
              }}
            >
              Editar dados
            </Link>
          ) : null}

          {canDelete && !isCurrentUserPermission ? (
            <form action={deletePermissionAction}>
              <input type="hidden" name="id" value={permissionItem.id} />
              <button
                type="submit"
                style={{ border: "1px solid #c83a3a", background: "#fff", color: "#b00020", borderRadius: "8px", padding: "0.45rem 0.65rem", cursor: "pointer" }}
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
              style={{ border: "1px solid #f1a1a1", color: "#b45353", background: "#fff6f6", borderRadius: "8px", padding: "0.45rem 0.65rem", cursor: "not-allowed" }}
            >
              Apagar dados
            </button>
          ) : null}
        </div>
      </div>

      {isViewing ? (
        <div style={{ marginTop: "0.8rem" }}>
          <p style={{ margin: 0 }}>
            <strong>Nome:</strong> {permissionItem.name}
          </p>
          <p style={{ margin: "0.35rem 0 0" }}>
            <strong>Tipo:</strong> {permissionItem.type === ADMIN_PERMISSION_TYPES.SYSTEM ? "SYSTEM PERMISSION" : "HOTEL PERMISSION"}
          </p>
        </div>
      ) : null}

      {isEditing ? <PermissionEditForm permissionItem={permissionItem} /> : null}
    </article>
  );
}
