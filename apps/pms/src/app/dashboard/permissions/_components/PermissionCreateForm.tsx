import { ADMIN_PERMISSION_TYPES } from "@hotel/shared";
import { createPermissionAction } from "../actions";
import { PendingSubmitButton } from "../../../_components/PendingSubmitButton";

type PermissionCreateFormProps = {
  formKey?: string;
};

export function PermissionCreateForm({ formKey }: PermissionCreateFormProps) {
  return (
    <article className="pms-surface-card">
      <h3 className="mt-0">Criar permissao</h3>

      <form key={formKey} action={createPermissionAction} className="grid gap-[0.7rem]">
        <div className="pms-field">
          <label htmlFor="create-permission-name">Nome</label>
          <input
            id="create-permission-name"
            name="name"
            minLength={3}
            required
            className="pms-field-input"
          />
        </div>

        <div className="pms-field">
          <label htmlFor="create-permission-type">Tipo</label>
          <select
            id="create-permission-type"
            name="type"
            defaultValue={ADMIN_PERMISSION_TYPES.SYSTEM}
            className="pms-field-input"
          >
            <option value={ADMIN_PERMISSION_TYPES.SYSTEM}>SYSTEM PERMISSION</option>
            <option value={ADMIN_PERMISSION_TYPES.HOTEL}>HOTEL PERMISSION</option>
          </select>
        </div>

        <PendingSubmitButton pendingLabel="Criando permissao..." className="justify-self-start">
          Criar permissao
        </PendingSubmitButton>
      </form>
    </article>
  );
}
