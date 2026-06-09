import { ADMIN_PERMISSION_TYPES } from "@hotel/shared";
import { createPermissionAction } from "../actions";
import { PendingSubmitButton } from "../../../_components/PendingSubmitButton";
import { FormField } from "../../_components/FormField";

type PermissionCreateFormProps = {
  formKey?: string;
};

export function PermissionCreateForm({ formKey }: PermissionCreateFormProps) {
  return (
    <article className="pms-surface-card">
      <h3 className="mt-0">Criar permissão</h3>

      <form key={formKey} action={createPermissionAction} className="grid gap-[0.7rem] md:grid-cols-2">
        <FormField label="Nome" htmlFor="create-permission-name">
          <input
            id="create-permission-name"
            name="name"
            minLength={3}
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField label="Tipo" htmlFor="create-permission-type">
          <select
            id="create-permission-type"
            name="type"
            defaultValue={ADMIN_PERMISSION_TYPES.SYSTEM}
            className="pms-field-input"
          >
            <option value={ADMIN_PERMISSION_TYPES.SYSTEM}>SYSTEM PERMISSION</option>
            <option value={ADMIN_PERMISSION_TYPES.HOTEL}>HOTEL PERMISSION</option>
          </select>
        </FormField>

        <PendingSubmitButton pendingLabel="Criando permissão..." className="justify-self-start md:col-span-2">
          Criar permissão
        </PendingSubmitButton>
      </form>
    </article>
  );
}
