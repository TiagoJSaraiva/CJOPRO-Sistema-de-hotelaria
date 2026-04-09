import type { AdminHotelOption, AdminRoleOption } from "@hotel/shared";
import { createUserAction } from "../actions";
import { UserRoleAssignmentsField } from "./UserRoleAssignmentsField";

type UserCreateFormProps = {
  hotels: AdminHotelOption[];
  roles: AdminRoleOption[];
};

export function UserCreateForm({ hotels, roles }: UserCreateFormProps) {
  return (
    <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Criar usuario</h3>

      <form action={createUserAction} style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-user-name">Nome</label>
          <input id="create-user-name" name="name" minLength={2} required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-user-email">Email</label>
          <input
            id="create-user-email"
            name="email"
            type="email"
            required
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-user-password">Senha temporaria</label>
          <input
            id="create-user-password"
            name="password_hash"
            type="password"
            minLength={6}
            required
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          />
        </div>

        <UserRoleAssignmentsField hotels={hotels} roles={roles} />

        <button
          type="submit"
          style={{ border: 0, background: "#0f6d5f", color: "#fff", borderRadius: "8px", padding: "0.6rem 0.8rem", cursor: "pointer", justifySelf: "start" }}
        >
          Criar usuario
        </button>
      </form>
    </article>
  );
}
