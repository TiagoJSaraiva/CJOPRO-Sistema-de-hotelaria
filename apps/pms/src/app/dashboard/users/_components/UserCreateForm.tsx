import type { AdminHotelOption, AdminRoleOption } from "@hotel/shared";
import { createUserAction } from "../actions";
import { UserRoleAssignmentsField } from "./UserRoleAssignmentsField";
import { FormField } from "../../_components/FormField";

type UserCreateFormProps = {
  formKey?: string;
  hotels: AdminHotelOption[];
  roles: AdminRoleOption[];
};

export function UserCreateForm({
  formKey,
  hotels,
  roles,
}: UserCreateFormProps) {
  return (
    <article className="pms-surface-card">
      <h3 className="mt-0">Criar usuário</h3>

      <form
        key={formKey}
        action={createUserAction}
        className="grid gap-[0.7rem] md:grid-cols-2"
      >
        <FormField label="Nome" htmlFor="create-user-name">
          <input
            id="create-user-name"
            name="name"
            minLength={2}
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField label="Email" htmlFor="create-user-email">
          <input
            id="create-user-email"
            name="email"
            type="email"
            required
            className="pms-field-input"
          />
        </FormField>

        <FormField
          label="Senha temporaria"
          htmlFor="create-user-password"
          fullWidth
        >
          <input
            id="create-user-password"
            name="password_hash"
            type="password"
            minLength={6}
            required
            className="pms-field-input"
          />
        </FormField>

        <UserRoleAssignmentsField hotels={hotels} roles={roles} />

        <button
          type="submit"
          className="justify-self-start rounded-lg border-0 bg-[#0f6d5f] px-[0.8rem] py-[0.6rem] text-white md:col-span-2"
        >
          Criar usuário
        </button>
      </form>
    </article>
  );
}
