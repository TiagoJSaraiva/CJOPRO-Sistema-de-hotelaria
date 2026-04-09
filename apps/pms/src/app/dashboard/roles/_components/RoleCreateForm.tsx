import type { AdminHotelOption, AdminPermissionOption } from "@hotel/shared";
import { createRoleAction } from "../actions";
import { RoleHotelPickerField } from "./RoleHotelPickerField";
import { RolePermissionAssignmentsField } from "./RolePermissionAssignmentsField";

type RoleCreateFormProps = {
  hotels: AdminHotelOption[];
  permissions: AdminPermissionOption[];
};

export function RoleCreateForm({ hotels, permissions }: RoleCreateFormProps) {
  return (
    <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Criar role</h3>

      <form action={createRoleAction} style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-role-name">Nome</label>
          <input id="create-role-name" name="name" minLength={2} required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <RoleHotelPickerField hotels={hotels} />
        <RolePermissionAssignmentsField permissions={permissions} />

        <button
          type="submit"
          style={{ border: 0, background: "#0f6d5f", color: "#fff", borderRadius: "8px", padding: "0.6rem 0.8rem", cursor: "pointer", justifySelf: "start" }}
        >
          Criar role
        </button>
      </form>
    </article>
  );
}
