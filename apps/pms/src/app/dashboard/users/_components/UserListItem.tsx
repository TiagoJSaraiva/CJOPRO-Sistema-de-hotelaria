"use client";

import Link from "next/link";
import { ADMIN_ROLE_TYPES, type AdminHotelOption, type AdminRoleOption, type AdminUser } from "@hotel/shared";
import { deleteUserAction, updateUserAction } from "../actions";
import { SelfManagementDisabledActions } from "./SelfManagementDisabledActions";
import { UserRoleAssignmentsField } from "./UserRoleAssignmentsField";

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
    <div style={{ display: "grid", gap: "0.7rem", marginTop: "0.85rem" }}>
      <p style={{ margin: 0 }}>
        <strong>Status:</strong> {userItem.is_active ? "Ativo" : "Inativo"}
      </p>
      <p style={{ margin: 0 }}>
        <strong>Criado em:</strong> {createdAt}
      </p>
      <p style={{ margin: 0 }}>
        <strong>Ultimo acesso:</strong> {lastLogin}
      </p>

      <div>
        <strong>Papeis vinculados:</strong>
        {userItem.role_assignments.length ? (
          <ul style={{ marginTop: "0.45rem", marginBottom: 0, paddingLeft: "1.1rem" }}>
            {userItem.role_assignments.map((assignment) => (
              <li key={`${assignment.role_id}-${assignment.hotel_id || "global"}`}>
                {(assignment.role_type === ADMIN_ROLE_TYPES.SYSTEM ? "Sistema" : assignment.hotel_name || "Hotel") + " - " + assignment.role_name}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: "0.35rem 0 0", color: "#626c79" }}>Sem papeis vinculados.</p>
        )}
      </div>
    </div>
  );
}

function UserEditForm({ userItem, hotels, roles }: { userItem: AdminUser; hotels: AdminHotelOption[]; roles: AdminRoleOption[] }) {
  return (
    <form action={updateUserAction} style={{ display: "grid", gap: "0.65rem", marginTop: "0.85rem" }}>
      <input type="hidden" name="id" value={userItem.id} />

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor={`name-${userItem.id}`}>Nome</label>
        <input
          id={`name-${userItem.id}`}
          name="name"
          defaultValue={userItem.name}
          required
          style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
        />
      </div>

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor={`email-${userItem.id}`}>Email</label>
        <input
          id={`email-${userItem.id}`}
          name="email"
          type="email"
          defaultValue={userItem.email}
          required
          style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
        />
      </div>

      <div style={{ display: "grid", gap: "0.35rem" }}>
        <label htmlFor={`password-${userItem.id}`}>Nova senha temporaria (opcional)</label>
        <input
          id={`password-${userItem.id}`}
          name="password_hash"
          type="password"
          minLength={6}
          style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
        />
      </div>

      <UserRoleAssignmentsField hotels={hotels} roles={roles} defaultAssignments={userItem.role_assignments} />

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input name="is_active" type="checkbox" defaultChecked={userItem.is_active} />
        <span>Usuario ativo</span>
      </label>

      <button
        type="submit"
        style={{ border: 0, background: "#1c6d4e", color: "#fff", borderRadius: "8px", padding: "0.55rem 0.75rem", cursor: "pointer", justifySelf: "start" }}
      >
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
    <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "0.95rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: "0.2rem" }}>{userItem.name}</h3>
          <p style={{ margin: 0, color: "#555" }}>{userItem.email}</p>
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

          {canEditThisUser ? (
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

          {canDeleteThisUser ? (
            <form action={deleteUserAction}>
              <input type="hidden" name="id" value={userItem.id} />
              <button
                type="submit"
                style={{ border: "1px solid #c83a3a", background: "#fff", color: "#b00020", borderRadius: "8px", padding: "0.45rem 0.65rem", cursor: "pointer" }}
              >
                Apagar dados
              </button>
            </form>
          ) : null}

          {isCurrentUser ? <SelfManagementDisabledActions showEdit={canUpdate} showDelete={canDelete} /> : null}
        </div>
      </div>

      {isViewing ? <UserDataPreview userItem={userItem} /> : null}
      {isEditing && canEditThisUser ? <UserEditForm userItem={userItem} hotels={hotels} roles={roles} /> : null}
    </article>
  );
}
