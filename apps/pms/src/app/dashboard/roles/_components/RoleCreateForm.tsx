"use client";

import { useState } from "react";
import type { AdminHotelOption, AdminPermissionOption } from "@hotel/shared";
import { ADMIN_ROLE_TYPES, type AdminRoleType } from "@hotel/shared";
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
  const [roleType, setRoleType] = useState<AdminRoleType>(ADMIN_ROLE_TYPES.SYSTEM);

  return (
    <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Criar role</h3>

      <form key={formKey} action={createRoleAction} style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-role-name">Nome</label>
          <input id="create-role-name" name="name" minLength={2} required style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }} />
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-role-type">Tipo da role</label>
          <select
            id="create-role-type"
            name="role_type"
            value={roleType}
            onChange={(event) => setRoleType(event.target.value as AdminRoleType)}
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          >
            <option value={ADMIN_ROLE_TYPES.SYSTEM}>SYSTEM ROLE</option>
            <option value={ADMIN_ROLE_TYPES.HOTEL}>HOTEL ROLE</option>
          </select>
        </div>

        <RoleHotelPickerField hotels={hotels} roleType={roleType} />
        <RolePermissionAssignmentsField roleType={roleType} permissions={permissions} />

        <PendingSubmitButton pendingLabel="Criando papel..." style={{ justifySelf: "start" }}>
          Criar papel
        </PendingSubmitButton>
      </form>
    </article>
  );
}
