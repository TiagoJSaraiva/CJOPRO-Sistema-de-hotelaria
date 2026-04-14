"use client";

import { useEffect, useMemo, useState } from "react";
import { ADMIN_PERMISSION_TYPES, ADMIN_ROLE_TYPES, type AdminPermissionOption, type AdminRolePermission, type AdminRoleType } from "@hotel/shared";
import { RelationListEditor } from "../../_components/RelationListEditor";
import { SelectionModal } from "../../_components/SelectionModal";

type RolePermissionAssignmentsFieldProps = {
  roleType: AdminRoleType;
  permissions: AdminPermissionOption[];
  defaultPermissions?: AdminRolePermission[];
  inputName?: string;
};

type PermissionItem = {
  id: string;
  name: string;
};

function getInitialPermissions(defaultPermissions?: AdminRolePermission[]): PermissionItem[] {
  if (!defaultPermissions?.length) {
    return [];
  }

  const seen = new Set<string>();

  return defaultPermissions
    .filter((item) => {
      if (!item.id || seen.has(item.id)) {
        return false;
      }

      seen.add(item.id);
      return true;
    })
    .map((item) => ({ id: item.id, name: item.name }));
}

export function RolePermissionAssignmentsField({
  roleType,
  permissions,
  defaultPermissions,
  inputName = "permission_ids"
}: RolePermissionAssignmentsFieldProps) {
  const [items, setItems] = useState<PermissionItem[]>(() => getInitialPermissions(defaultPermissions));
  const [isModalOpen, setIsModalOpen] = useState(false);

  const expectedPermissionType = roleType === ADMIN_ROLE_TYPES.SYSTEM ? ADMIN_PERMISSION_TYPES.SYSTEM : ADMIN_PERMISSION_TYPES.HOTEL;

  useEffect(() => {
    setItems((current) =>
      current.filter((item) => {
        const permission = permissions.find((permissionOption) => permissionOption.id === item.id);
        return permission?.type === expectedPermissionType;
      })
    );
  }, [permissions, expectedPermissionType]);

  const availablePermissions = useMemo(
    () =>
      permissions
        .filter((permission) => permission.type === expectedPermissionType)
        .filter((permission) => !items.some((item) => item.id === permission.id)),
    [permissions, expectedPermissionType, items]
  );

  const serializedValue = JSON.stringify(items.map((item) => item.id));

  return (
    <>
      <RelationListEditor
        title="Permissoes da role"
        addLabel="Adicionar permissao"
        emptyMessage="Nenhuma permissao vinculada a role."
        items={items.map((item) => ({ id: item.id, primary: item.name }))}
        onAdd={() => setIsModalOpen(true)}
        onRemove={(permissionId) => setItems((current) => current.filter((item) => item.id !== permissionId))}
      />

      <input type="hidden" name={inputName} value={serializedValue} readOnly />

      <SelectionModal
        open={isModalOpen}
        title="Selecione uma permissao"
        items={availablePermissions.map((permission) => ({
          id: permission.id,
          label: permission.name,
          description: permission.type === ADMIN_PERMISSION_TYPES.SYSTEM ? "SYSTEM PERMISSION" : "HOTEL PERMISSION"
        }))}
        emptyMessage="Nao existem permissoes disponiveis para o tipo de role selecionado."
        onSelect={(permissionId) => {
          const selectedPermission = permissions.find((permission) => permission.id === permissionId);

          if (!selectedPermission) {
            return;
          }

          setItems((current) => {
            if (current.some((item) => item.id === selectedPermission.id)) {
              return current;
            }

            return [...current, { id: selectedPermission.id, name: selectedPermission.name }];
          });
        }}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
