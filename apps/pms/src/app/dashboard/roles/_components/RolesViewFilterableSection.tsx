"use client";

import { useMemo, type ReactNode } from "react";
import { ADMIN_ROLE_TYPES, type AdminHotelOption, type AdminPermissionOption, type AdminRole } from "@hotel/shared";
import { RoleListItem } from "./RoleListItem";
import { DEFAULT_ROLE_VIEW_FILTERS, applyRoleViewFilters, countAppliedRoleFilters, type RoleViewFilters } from "./roleViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";

type RolesViewFilterableSectionProps = {
  roles: AdminRole[];
  hotels: AdminHotelOption[];
  permissions: AdminPermissionOption[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  currentUserRoleIds: string[];
  activeRoleId: string;
  mode: "view" | "edit";
  children?: ReactNode;
};

export function RolesViewFilterableSection({
  roles,
  hotels,
  permissions,
  canRead,
  canUpdate,
  canDelete,
  currentUserRoleIds,
  activeRoleId,
  mode,
  children
}: RolesViewFilterableSectionProps) {
  const {
    isModalOpen,
    appliedFilters,
    draftFilters,
    openFilters,
    closeFilters,
    applyFilters,
    clearFilters,
    updateDraftFilter
  } = useViewFiltersState<RoleViewFilters>(DEFAULT_ROLE_VIEW_FILTERS);

  const appliedFilterCount = countAppliedRoleFilters(appliedFilters);

  const filteredRoles = useMemo(() => applyRoleViewFilters(roles, appliedFilters), [roles, appliedFilters]);

  return (
    <EntityViewFilterableSection
      appliedFilterCount={appliedFilterCount}
      totalCount={roles.length}
      filteredItems={filteredRoles}
      itemLabelPlural="roles"
      filtersTitle="Filtros de roles"
      isModalOpen={isModalOpen}
      onOpenFilters={openFilters}
      onCloseFilters={closeFilters}
      onApplyFilters={applyFilters}
      onClearFilters={clearFilters}
      emptyMessage="Nenhuma role cadastrada ate o momento."
      filteredEmptyMessage="Nenhuma role corresponde aos filtros aplicados."
      getItemKey={(item) => item.id}
      renderItem={(item) => (
        <RoleListItem
          roleItem={item}
          hotels={hotels}
          permissions={permissions}
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isCurrentUserRole={currentUserRoleIds.includes(item.id)}
          isViewing={activeRoleId === item.id && mode === "view"}
          isEditing={activeRoleId === item.id && mode === "edit"}
        />
      )}
      filters={
        <div className="grid grid-cols-1 gap-[0.75rem] md:grid-cols-2 xl:grid-cols-3">
          <label className="pms-field">
            <span>Nome da role</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraftFilter("search", event.target.value)}
              placeholder="Ex.: admin"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Tipo da role</span>
            <select
              value={draftFilters.roleType}
              onChange={(event) => updateDraftFilter("roleType", event.target.value as RoleViewFilters["roleType"])}
              className={viewFiltersFieldClassName}
            >
              <option value="">Todos</option>
              <option value={ADMIN_ROLE_TYPES.SYSTEM}>SYSTEM ROLE</option>
              <option value={ADMIN_ROLE_TYPES.HOTEL}>HOTEL ROLE</option>
            </select>
          </label>

          <label className="pms-field">
            <span>Hotel</span>
            <select value={draftFilters.hotelId} onChange={(event) => updateDraftFilter("hotelId", event.target.value)} className={viewFiltersFieldClassName}>
              <option value="">Todos</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </label>

          <label className="pms-field">
            <span>Permissao vinculada</span>
            <select value={draftFilters.permissionId} onChange={(event) => updateDraftFilter("permissionId", event.target.value)} className={viewFiltersFieldClassName}>
              <option value="">Todas</option>
              {permissions.map((permission) => (
                <option key={permission.id} value={permission.id}>
                  {permission.name} {permission.type === "SYSTEM_PERMISSION" ? "(SYSTEM)" : "(HOTEL)"}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      {children}
    </EntityViewFilterableSection>
  );
}
