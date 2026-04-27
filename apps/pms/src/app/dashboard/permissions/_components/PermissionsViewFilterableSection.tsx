"use client";

import { useMemo, type ReactNode } from "react";
import { ADMIN_PERMISSION_TYPES, type AdminPermission } from "@hotel/shared";
import { PermissionListItem } from "./PermissionListItem";
import {
  DEFAULT_PERMISSION_VIEW_FILTERS,
  applyPermissionViewFilters,
  countAppliedPermissionFilters,
  type PermissionViewFilters
} from "./permissionViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";

type PermissionsViewFilterableSectionProps = {
  permissions: AdminPermission[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  currentUserPermissionNames: string[];
  activePermissionId: string;
  mode: "view" | "edit";
  children?: ReactNode;
};

export function PermissionsViewFilterableSection({
  permissions,
  canRead,
  canUpdate,
  canDelete,
  currentUserPermissionNames,
  activePermissionId,
  mode,
  children
}: PermissionsViewFilterableSectionProps) {
  const {
    isModalOpen,
    appliedFilters,
    draftFilters,
    openFilters,
    closeFilters,
    applyFilters,
    clearFilters,
    updateDraftFilter
  } = useViewFiltersState<PermissionViewFilters>(DEFAULT_PERMISSION_VIEW_FILTERS);

  const appliedFilterCount = countAppliedPermissionFilters(appliedFilters);

  const filteredPermissions = useMemo(
    () => applyPermissionViewFilters(permissions, appliedFilters),
    [permissions, appliedFilters]
  );

  return (
    <EntityViewFilterableSection
      appliedFilterCount={appliedFilterCount}
      totalCount={permissions.length}
      filteredItems={filteredPermissions}
      itemLabelPlural="permissoes"
      filtersTitle="Filtros de permissoes"
      isModalOpen={isModalOpen}
      onOpenFilters={openFilters}
      onCloseFilters={closeFilters}
      onApplyFilters={applyFilters}
      onClearFilters={clearFilters}
      emptyMessage="Nenhuma permissao cadastrada ate o momento."
      filteredEmptyMessage="Nenhuma permissao corresponde aos filtros aplicados."
      getItemKey={(item) => item.id}
      renderItem={(item) => (
        <PermissionListItem
          permissionItem={item}
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isCurrentUserPermission={currentUserPermissionNames.includes(item.name)}
          isViewing={activePermissionId === item.id && mode === "view"}
          isEditing={activePermissionId === item.id && mode === "edit"}
        />
      )}
      filters={
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[0.75rem]">
          <label className="pms-field">
            <span>Nome da permissao</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraftFilter("search", event.target.value)}
              placeholder="Ex.: USER_READ"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Tipo</span>
            <select
              value={draftFilters.type}
              onChange={(event) => updateDraftFilter("type", event.target.value as "" | "SYSTEM_PERMISSION" | "HOTEL_PERMISSION")}
              className={viewFiltersFieldClassName}
            >
              <option value="">Todos</option>
              <option value={ADMIN_PERMISSION_TYPES.SYSTEM}>SYSTEM PERMISSION</option>
              <option value={ADMIN_PERMISSION_TYPES.HOTEL}>HOTEL PERMISSION</option>
            </select>
          </label>
        </div>
      }
    >
      {children}
    </EntityViewFilterableSection>
  );
}
