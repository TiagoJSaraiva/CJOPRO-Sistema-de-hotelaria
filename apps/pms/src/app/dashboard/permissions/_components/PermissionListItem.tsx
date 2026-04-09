import Link from "next/link";
import type { AdminPermission } from "@hotel/shared";
import { deletePermissionAction, updatePermissionAction } from "../actions";

type PermissionListItemProps = {
  permissionItem: AdminPermission;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
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

      <button
        type="submit"
        style={{ border: 0, background: "#1c6d4e", color: "#fff", borderRadius: "8px", padding: "0.55rem 0.75rem", cursor: "pointer", justifySelf: "start" }}
      >
        Salvar alteracoes
      </button>
    </form>
  );
}

export function PermissionListItem({ permissionItem, canRead, canUpdate, canDelete, isViewing, isEditing }: PermissionListItemProps) {
  const viewHref = `/dashboard/permissions/view?permissionId=${permissionItem.id}&mode=view`;
  const editHref = `/dashboard/permissions/view?permissionId=${permissionItem.id}&mode=edit`;

  return (
    <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "0.95rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: "0.2rem" }}>{permissionItem.name}</h3>
          <p style={{ margin: 0, color: "#555" }}>ID: {permissionItem.id}</p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          {canRead ? (
            <Link
              href={viewHref}
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

          {canDelete ? (
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
        </div>
      </div>

      {isViewing ? (
        <div style={{ marginTop: "0.8rem" }}>
          <p style={{ margin: 0 }}>
            <strong>Nome:</strong> {permissionItem.name}
          </p>
        </div>
      ) : null}

      {isEditing ? <PermissionEditForm permissionItem={permissionItem} /> : null}
    </article>
  );
}
