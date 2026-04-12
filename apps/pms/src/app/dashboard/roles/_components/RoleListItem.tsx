import Link from "next/link";
import type { AdminHotelOption, AdminPermissionOption, AdminRole } from "@hotel/shared";
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
  isViewing: boolean;
  isEditing: boolean;
};

function RoleDataPreview({ roleItem }: { roleItem: AdminRole }) {
  return (
    <div style={{ display: "grid", gap: "0.7rem", marginTop: "0.85rem" }}>
      <p style={{ margin: 0 }}>
        <strong>Hotel associado:</strong> {roleItem.hotel_name || "GLOBAL"}
      </p>

      <div>
        <strong>Permissoes vinculadas:</strong>
        {roleItem.permissions.length ? (
          <ul style={{ marginTop: "0.45rem", marginBottom: 0, paddingLeft: "1.1rem" }}>
            {roleItem.permissions.map((permission) => (
              <li key={permission.id}>{permission.name}</li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: "0.35rem 0 0", color: "#626c79" }}>Sem permissoes vinculadas.</p>
        )}
      </div>
    </div>
  );
}

function RoleEditForm({ roleItem, hotels, permissions }: { roleItem: AdminRole; hotels: AdminHotelOption[]; permissions: AdminPermissionOption[] }) {
  return (
    <form action={updateRoleAction} style={{ display: "grid", gap: "0.65rem", marginTop: "0.85rem" }}>
      <input type="hidden" name="id" value={roleItem.id} />

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor={`name-${roleItem.id}`}>Nome</label>
        <input
          id={`name-${roleItem.id}`}
          name="name"
          defaultValue={roleItem.name}
          required
          style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
        />
      </div>

      <RoleHotelPickerField hotels={hotels} defaultHotelId={roleItem.hotel_id} />
      <RolePermissionAssignmentsField permissions={permissions} defaultPermissions={roleItem.permissions} />

      <button
        type="submit"
        style={{ border: 0, background: "#1c6d4e", color: "#fff", borderRadius: "8px", padding: "0.55rem 0.75rem", cursor: "pointer", justifySelf: "start" }}
      >
        Salvar alteracoes
      </button>
    </form>
  );
}

export function RoleListItem({ roleItem, hotels, permissions, canRead, canUpdate, canDelete, isViewing, isEditing }: RoleListItemProps) {
  const viewHref = `/dashboard/roles/view?roleId=${roleItem.id}&mode=view`;
  const editHref = `/dashboard/roles/view?roleId=${roleItem.id}&mode=edit`;

  return (
    <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "0.95rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: "0.2rem" }}>{roleItem.name}</h3>
          <p style={{ margin: 0, color: "#555" }}>Hotel: {roleItem.hotel_name || "GLOBAL"}</p>
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

          {canDelete ? (
            <form action={deleteRoleAction}>
              <input type="hidden" name="id" value={roleItem.id} />
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

      {isViewing ? <RoleDataPreview roleItem={roleItem} /> : null}
      {isEditing ? <RoleEditForm roleItem={roleItem} hotels={hotels} permissions={permissions} /> : null}
    </article>
  );
}
