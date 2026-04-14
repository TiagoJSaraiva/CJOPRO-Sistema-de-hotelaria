"use client";

import { useMemo, useState } from "react";
import { ADMIN_ROLE_TYPES, type AdminHotelOption, type AdminRoleOption, type AdminRoleType, type AdminUserRoleAssignment } from "@hotel/shared";
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
  role_type: AdminRoleType;
  hotel_id: string | null;
  hotel_name: string | null;
};

const SYSTEM_CONTEXT_OPTION_ID = "__system_context__";

function getInitialAssignments(defaultAssignments: AdminUserRoleAssignment[] | undefined): AssignmentItem[] {
  if (!defaultAssignments?.length) {
    return [];
  }

  const seen = new Set<string>();

  return defaultAssignments
    .filter((item) => {
      const dedupeKey = `${item.role_id || ""}::${item.hotel_id || "__null__"}`;

      if (!item.role_id || seen.has(dedupeKey)) {
        return false;
      }

      seen.add(dedupeKey);
      return true;
    })
    .map((item) => ({
      role_id: item.role_id,
      role_name: item.role_name,
      role_type: item.role_type,
      hotel_id: item.hotel_id,
      hotel_name: item.hotel_name
    }));
}

export function UserRoleAssignmentsField({ roles, hotels, defaultAssignments, inputName = "role_assignments" }: UserRoleAssignmentsFieldProps) {
  const [assignments, setAssignments] = useState<AssignmentItem[]>(() => getInitialAssignments(defaultAssignments));
  const [selectedContextType, setSelectedContextType] = useState<"SYSTEM" | "HOTEL">("SYSTEM");
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  const selectedHotel = useMemo(() => hotels.find((hotel) => hotel.id === selectedHotelId) || null, [hotels, selectedHotelId]);

  const selectedContextLabel = useMemo(() => {
    if (selectedContextType === "SYSTEM") {
      return "Sistema";
    }

    return selectedHotel?.name || "Hotel";
  }, [selectedContextType, selectedHotel]);

  const assignmentKeySet = useMemo(
    () =>
      new Set(
        assignments.map((item) => `${item.role_id}::${item.hotel_id || "__null__"}`)
      ),
    [assignments]
  );

  const availableRoles = useMemo(() => {
    const byContext = roles.filter((role) => {
      if (selectedContextType === "SYSTEM") {
        return role.role_type === ADMIN_ROLE_TYPES.SYSTEM;
      }

      if (role.role_type !== ADMIN_ROLE_TYPES.HOTEL) {
        return false;
      }

      if (role.hotel_id) {
        return role.hotel_id === selectedHotelId;
      }

      return !!selectedHotelId;
    });

    return byContext.filter((role) => {
      const effectiveHotelId = role.role_type === ADMIN_ROLE_TYPES.SYSTEM ? null : role.hotel_id || selectedHotelId;
      const dedupeKey = `${role.id}::${effectiveHotelId || "__null__"}`;
      return !assignmentKeySet.has(dedupeKey);
    });
  }, [roles, selectedContextType, selectedHotelId, assignmentKeySet]);

  const assignmentRows = assignments.map((item) => {
    const contextLabel = item.role_type === ADMIN_ROLE_TYPES.SYSTEM ? "Sistema" : item.hotel_name || "Hotel";

    return {
      id: `${item.role_id}::${item.hotel_id || "__null__"}`,
      primary: `${contextLabel} - ${item.role_name}`,
      secondary: item.role_type === ADMIN_ROLE_TYPES.SYSTEM ? "SYSTEM ROLE" : "HOTEL ROLE"
    };
  });

  const serializedValue = JSON.stringify(assignments.map((item) => ({ role_id: item.role_id, hotel_id: item.hotel_id })));

  const handleAddClick = () => {
    setSelectedContextType("SYSTEM");
    setSelectedHotelId(null);
    setIsContextModalOpen(true);
  };

  const handleContextSelect = (contextId: string) => {
    if (contextId === SYSTEM_CONTEXT_OPTION_ID) {
      setSelectedContextType("SYSTEM");
      setSelectedHotelId(null);
    } else {
      setSelectedContextType("HOTEL");
      setSelectedHotelId(contextId);
    }

    setIsContextModalOpen(false);
    setIsRoleModalOpen(true);
  };

  const handleRoleSelect = (roleId: string) => {
    const selectedRole = roles.find((role) => role.id === roleId);

    if (!selectedRole) {
      return;
    }

    const effectiveHotelId =
      selectedRole.role_type === ADMIN_ROLE_TYPES.SYSTEM
        ? null
        : selectedRole.hotel_id || selectedHotelId;

    const effectiveHotelName =
      selectedRole.role_type === ADMIN_ROLE_TYPES.SYSTEM
        ? "Sistema"
        : selectedRole.hotel_name || selectedHotel?.name || null;

    const dedupeKey = `${selectedRole.id}::${effectiveHotelId || "__null__"}`;

    setAssignments((current) => {
      const existingKeys = new Set(current.map((item) => `${item.role_id}::${item.hotel_id || "__null__"}`));

      if (existingKeys.has(dedupeKey)) {
        return current;
      }

      return [
        ...current,
        {
          role_id: selectedRole.id,
          role_name: selectedRole.name,
          role_type: selectedRole.role_type,
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
        onRemove={(assignmentKey) =>
          setAssignments((current) => current.filter((item) => `${item.role_id}::${item.hotel_id || "__null__"}` !== assignmentKey))
        }
      />

      <input type="hidden" name={inputName} value={serializedValue} readOnly />

      <SelectionModal
        open={isContextModalOpen}
        title="Selecione o contexto"
        items={[
          { id: SYSTEM_CONTEXT_OPTION_ID, label: "Sistema", description: "Atribuir roles de sistema." },
          ...hotels.map((hotel) => ({ id: hotel.id, label: hotel.name, description: "Atribuir roles de hotel." }))
        ]}
        emptyMessage="Nenhum contexto disponivel para selecao."
        onSelect={handleContextSelect}
        onClose={() => setIsContextModalOpen(false)}
      />

      <SelectionModal
        open={isRoleModalOpen}
        title="Selecione um papel"
        items={availableRoles.map((role) => ({
          id: role.id,
          label: role.name,
          description:
            role.role_type === ADMIN_ROLE_TYPES.SYSTEM
              ? "SYSTEM ROLE"
              : role.hotel_id
                ? `HOTEL ROLE - ${role.hotel_name || selectedContextLabel}`
                : `HOTEL ROLE GENERICA - vinculada em ${selectedContextLabel}`
        }))}
        emptyMessage="Nao existem papeis disponiveis para o contexto selecionado."
        onSelect={handleRoleSelect}
        onClose={() => {
          setIsRoleModalOpen(false);
          setSelectedContextType("SYSTEM");
          setSelectedHotelId(null);
        }}
      />
    </>
  );
}
