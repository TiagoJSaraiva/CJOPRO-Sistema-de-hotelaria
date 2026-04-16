import type { AdminHotelOption, AdminRoleOption } from "@hotel/shared";
import { createUserAction } from "../actions";
import { UserRoleAssignmentsField } from "./UserRoleAssignmentsField";

type UserCreateFormProps = {
  formKey?: string;
  hotels: AdminHotelOption[];
  roles: AdminRoleOption[];
};

export function UserCreateForm({ formKey, hotels, roles }: UserCreateFormProps) {
  return (
    <article className="pms-surface-card">
      <h3 className="mt-0">Criar usuario</h3>

      <form key={formKey} action={createUserAction} className="grid gap-[0.7rem]">
        <div className="pms-field">
          <label htmlFor="create-user-name">Nome</label>
          <input id="create-user-name" name="name" minLength={2} required className="pms-field-input" />
        </div>

        <div className="pms-field">
          <label htmlFor="create-user-email">Email</label>
          <input
            id="create-user-email"
            name="email"
            type="email"
            required
            className="pms-field-input"
          />
        </div>

        <div className="pms-field">
          <label htmlFor="create-user-password">Senha temporaria</label>
          <input
            id="create-user-password"
            name="password_hash"
            type="password"
            minLength={6}
            required
            className="pms-field-input"
          />
        </div>

        <UserRoleAssignmentsField hotels={hotels} roles={roles} />

        <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#0f6d5f] px-[0.8rem] py-[0.6rem] text-white">
          Criar usuario
        </button>
      </form>
    </article>
  );
}
