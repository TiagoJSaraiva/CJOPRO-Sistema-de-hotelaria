"use client";

import { useMemo, useState } from "react";
import type { AdminPermissionOption, AdminRolePermission } from "@hotel/shared";
import { RelationListEditor } from "../../_components/RelationListEditor";
import { SelectionModal } from "../../_components/SelectionModal";

type RolePermissionAssignmentsFieldProps = {
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

export function RolePermissionAssignmentsField({ permissions, defaultPermissions, inputName = "permission_ids" }: RolePermissionAssignmentsFieldProps) {
  const [items, setItems] = useState<PermissionItem[]>(() => getInitialPermissions(defaultPermissions));
  const [isModalOpen, setIsModalOpen] = useState(false);

  const availablePermissions = useMemo(
    () => permissions.filter((permission) => !items.some((item) => item.id === permission.id)),
    [permissions, items]
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
        items={availablePermissions.map((permission) => ({ id: permission.id, label: permission.name }))}
        emptyMessage="Nao existem permissoes disponiveis para adicao."
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

          setIsModalOpen(false);
        }}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
