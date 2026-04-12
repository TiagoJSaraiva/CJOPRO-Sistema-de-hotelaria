"use client";

import { useMemo, useState } from "react";
import type { AdminHotelOption, AdminRoleOption, AdminUserRoleAssignment } from "@hotel/shared";
import { RelationListEditor } from "../../_components/RelationListEditor";
import { SelectionModal } from "../../_components/SelectionModal";

type UserRoleAssignmentsFieldProps = {
  roles: AdminRoleOption[];
  hotels: AdminHotelOption[];
  defaultAssignments?: AdminUserRoleAssignment[];
  inputName?: string;
};

type AssignmentItem = {
  role_id: string;
  role_name: string;
  hotel_id: string | null;
  hotel_name: string | null;
};

const GLOBAL_HOTEL_OPTION_ID = "__global_role_context__";

function getInitialAssignments(defaultAssignments: AdminUserRoleAssignment[] | undefined): AssignmentItem[] {
  if (!defaultAssignments?.length) {
    return [];
  }

  const seen = new Set<string>();

  return defaultAssignments
    .filter((item) => {
      if (!item.role_id || seen.has(item.role_id)) {
        return false;
      }

      seen.add(item.role_id);
      return true;
    })
    .map((item) => ({
      role_id: item.role_id,
      role_name: item.role_name,
      hotel_id: item.hotel_id,
      hotel_name: item.hotel_name
    }));
}

export function UserRoleAssignmentsField({ roles, hotels, defaultAssignments, inputName = "role_assignments" }: UserRoleAssignmentsFieldProps) {
  const [assignments, setAssignments] = useState<AssignmentItem[]>(() => getInitialAssignments(defaultAssignments));
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [isHotelModalOpen, setIsHotelModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  const selectedHotel = useMemo(() => hotels.find((hotel) => hotel.id === selectedHotelId) || null, [hotels, selectedHotelId]);

  const availableRoles = useMemo(() => {
    return roles
      .filter((role) => {
        if (selectedHotelId === null) {
          return role.hotel_id === null;
        }

        return role.hotel_id === selectedHotelId;
      })
      .filter((role) => !assignments.some((assignment) => assignment.role_id === role.id));
  }, [roles, selectedHotelId, assignments]);

  const assignmentRows = assignments.map((item) => ({
    id: item.role_id,
    primary: `${item.hotel_name || "GLOBAL"} - ${item.role_name}`,
    secondary: item.hotel_id ? `Hotel: ${item.hotel_name || "-"}` : "Role global"
  }));

  const serializedValue = JSON.stringify(assignments.map((item) => ({ role_id: item.role_id, hotel_id: item.hotel_id })));

  const handleAddClick = () => {
    setSelectedHotelId(null);
    setIsHotelModalOpen(true);
  };

  const handleHotelSelect = (hotelId: string) => {
    setSelectedHotelId(hotelId === GLOBAL_HOTEL_OPTION_ID ? null : hotelId);
    setIsHotelModalOpen(false);
    setIsRoleModalOpen(true);
  };

  const handleRoleSelect = (roleId: string) => {
    const selectedRole = roles.find((role) => role.id === roleId);

    if (!selectedRole) {
      return;
    }

    const effectiveHotelId = selectedRole.hotel_id || selectedHotelId;
    const effectiveHotelName =
      (selectedRole.hotel_id ? hotels.find((hotel) => hotel.id === selectedRole.hotel_id)?.name : selectedHotel?.name) ||
      selectedRole.hotel_name ||
      (selectedRole.hotel_id ? null : "GLOBAL");

    setAssignments((current) => {
      if (current.some((item) => item.role_id === roleId)) {
        return current;
      }

      return [
        ...current,
        {
          role_id: selectedRole.id,
          role_name: selectedRole.name,
          hotel_id: effectiveHotelId || null,
          hotel_name: effectiveHotelName
        }
      ];
    });
  };

  return (
    <>
      <RelationListEditor
        title="Papeis"
        addLabel="Adicionar papel"
        emptyMessage="Nenhum papel vinculado ao usuario."
        items={assignmentRows}
        onAdd={handleAddClick}
        onRemove={(roleId) => setAssignments((current) => current.filter((item) => item.role_id !== roleId))}
      />

      <input type="hidden" name={inputName} value={serializedValue} readOnly />

      <SelectionModal
        open={isHotelModalOpen}
        title="Selecione um hotel"
        items={[
          { id: GLOBAL_HOTEL_OPTION_ID, label: "GLOBAL", description: "Selecionar papeis globais." },
          ...hotels.map((hotel) => ({ id: hotel.id, label: hotel.name }))
        ]}
        emptyMessage="Nenhum hotel disponivel para selecao."
        onSelect={handleHotelSelect}
        onClose={() => setIsHotelModalOpen(false)}
      />

      <SelectionModal
        open={isRoleModalOpen}
        title="Selecione um papel"
        items={availableRoles.map((role) => ({
          id: role.id,
          label: role.name,
          description: role.hotel_id ? `Role do hotel ${selectedHotel?.name || role.hotel_name || "-"}` : "Role global"
        }))}
        emptyMessage="Nao existem papeis disponiveis para o hotel selecionado."
        onSelect={handleRoleSelect}
        onClose={() => {
          setIsRoleModalOpen(false);
          setSelectedHotelId(null);
        }}
      />
    </>
  );
}
