import { ADMIN_PERMISSION_TYPES } from "@hotel/shared";
import { createPermissionAction } from "../actions";
import { PendingSubmitButton } from "../../../_components/PendingSubmitButton";

type PermissionCreateFormProps = {
  formKey?: string;
};

export function PermissionCreateForm({ formKey }: PermissionCreateFormProps) {
  return (
    <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Criar permissao</h3>

      <form key={formKey} action={createPermissionAction} style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-permission-name">Nome</label>
          <input
            id="create-permission-name"
            name="name"
            minLength={3}
            required
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-permission-type">Tipo</label>
          <select
            id="create-permission-type"
            name="type"
            defaultValue={ADMIN_PERMISSION_TYPES.SYSTEM}
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          >
            <option value={ADMIN_PERMISSION_TYPES.SYSTEM}>SYSTEM PERMISSION</option>
            <option value={ADMIN_PERMISSION_TYPES.HOTEL}>HOTEL PERMISSION</option>
          </select>
        </div>

        <PendingSubmitButton pendingLabel="Criando permissao..." style={{ justifySelf: "start" }}>
          Criar permissao
        </PendingSubmitButton>
      </form>
    </article>
  );
}
