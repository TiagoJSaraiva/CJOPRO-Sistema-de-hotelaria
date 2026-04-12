import type { AdminHotelOption, AdminPermissionOption } from "@hotel/shared";
import { createRoleAction } from "../actions";
import { RoleHotelPickerField } from "./RoleHotelPickerField";
import { RolePermissionAssignmentsField } from "./RolePermissionAssignmentsField";
import { PendingSubmitButton } from "../../../_components/PendingSubmitButton";

type RoleCreateFormProps = {
  formKey?: string;
  hotels: AdminHotelOption[];
  permissions: AdminPermissionOption[];
};

export function RoleCreateForm({ formKey, hotels, permissions }: RoleCreateFormProps) {
  return (
    <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Criar role</h3>

      <form key={formKey} action={createRoleAction} style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-role-name">Nome</label>
          <input id="create-role-name" name="name" minLength={2} required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <RoleHotelPickerField hotels={hotels} />
        <RolePermissionAssignmentsField permissions={permissions} />

        <PendingSubmitButton pendingLabel="Criando papel..." style={{ justifySelf: "start" }}>
          Criar papel
        </PendingSubmitButton>
      </form>
    </article>
  );
}
