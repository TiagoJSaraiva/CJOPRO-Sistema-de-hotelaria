"use client";

import { useState } from "react";
import type { AdminHotelOption, AdminPermissionOption } from "@hotel/shared";
import { ADMIN_ROLE_TYPES, type AdminRoleType } from "@hotel/shared";
import { createRoleAction } from "../actions";
import { RoleHotelPickerField } from "./RoleHotelPickerField";
import { RolePermissionAssignmentsField } from "./RolePermissionAssignmentsField";
import { PendingSubmitButton } from "../../../_components/PendingSubmitButton";
import { FormField } from "../../_components/FormField";

type RoleCreateFormProps = {
  formKey?: string;
  hotels: AdminHotelOption[];
  permissions: AdminPermissionOption[];
};

export function RoleCreateForm({ formKey, hotels, permissions }: RoleCreateFormProps) {
  const [roleType, setRoleType] = useState<AdminRoleType>(ADMIN_ROLE_TYPES.SYSTEM);

  return (
    <article className="pms-surface-card">
      <h3 className="mt-0">Criar role</h3>

      <form key={formKey} action={createRoleAction} className="grid gap-[0.7rem] md:grid-cols-2">
        <FormField label="Nome" htmlFor="create-role-name">
          <input id="create-role-name" name="name" minLength={2} required className="pms-field-input" />
        </FormField>

        <FormField label="Tipo da role" htmlFor="create-role-type">
          <select
            id="create-role-type"
            name="role_type"
            value={roleType}
            onChange={(event) => setRoleType(event.target.value as AdminRoleType)}
            className="pms-field-input"
          >
            <option value={ADMIN_ROLE_TYPES.SYSTEM}>SYSTEM ROLE</option>
            <option value={ADMIN_ROLE_TYPES.HOTEL}>HOTEL ROLE</option>
          </select>
        </FormField>

        <RoleHotelPickerField hotels={hotels} roleType={roleType} />
        <RolePermissionAssignmentsField roleType={roleType} permissions={permissions} />

        <PendingSubmitButton pendingLabel="Criando papel..." className="justify-self-start md:col-span-2">
          Criar papel
        </PendingSubmitButton>
      </form>
    </article>
  );
}
