"use client";

import { useMemo, type ReactNode } from "react";
import { type AdminHotelOption, type AdminRoleOption, type AdminUser } from "@hotel/shared";
import { UserListItem } from "./UserListItem";
import { DEFAULT_USER_VIEW_FILTERS, applyUserViewFilters, countAppliedUserFilters, type UserViewFilters } from "./userViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";
import { formatRoleOptionLabel } from "./userRoleLabels";

type UsersViewFilterableSectionProps = {
  users: AdminUser[];
  hotels: AdminHotelOption[];
  roles: AdminRoleOption[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  currentUserId?: string;
  activeUserId: string;
  mode: "view" | "edit";
  children?: ReactNode;
};

function getRoleLabel(role: AdminRoleOption): string {
  return formatRoleOptionLabel(role);
}

export function UsersViewFilterableSection({
  users,
  hotels,
  roles,
  canRead,
  canUpdate,
  canDelete,
  currentUserId,
  activeUserId,
  mode,
  children
}: UsersViewFilterableSectionProps) {
  const {
    isModalOpen,
    appliedFilters,
    draftFilters,
    openFilters,
    closeFilters,
    applyFilters,
    clearFilters,
    updateDraftFilter
  } = useViewFiltersState<UserViewFilters>(DEFAULT_USER_VIEW_FILTERS);

  const appliedFilterCount = countAppliedUserFilters(appliedFilters);

  const filteredUsers = useMemo(() => applyUserViewFilters(users, appliedFilters), [users, appliedFilters]);

  return (
    <EntityViewFilterableSection
      appliedFilterCount={appliedFilterCount}
      totalCount={users.length}
      filteredItems={filteredUsers}
      itemLabelPlural="usuarios"
      filtersTitle="Filtros de usuarios"
      isModalOpen={isModalOpen}
      onOpenFilters={openFilters}
      onCloseFilters={closeFilters}
      onApplyFilters={applyFilters}
      onClearFilters={clearFilters}
      emptyMessage="Nenhum usuario cadastrado ate o momento."
      filteredEmptyMessage="Nenhum usuario corresponde aos filtros aplicados."
      getItemKey={(item) => item.id}
      renderItem={(item) => (
        <UserListItem
          userItem={item}
          hotels={hotels}
          roles={roles}
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isCurrentUser={currentUserId === item.id}
          isViewing={activeUserId === item.id && mode === "view"}
          isEditing={activeUserId === item.id && mode === "edit"}
        />
      )}
      filters={
        <div className="grid grid-cols-1 gap-[0.75rem] md:grid-cols-2 xl:grid-cols-3">
          <label className="pms-field">
            <span>Nome ou email</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraftFilter("search", event.target.value)}
              placeholder="Ex.: maria ou hotel.com"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Status</span>
            <select
              value={draftFilters.status}
              onChange={(event) => updateDraftFilter("status", event.target.value as UserViewFilters["status"])}
              className={viewFiltersFieldClassName}
            >
              <option value="all">Todos</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
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
            <span>Role</span>
            <select value={draftFilters.roleId} onChange={(event) => updateDraftFilter("roleId", event.target.value)} className={viewFiltersFieldClassName}>
              <option value="">Todas</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {getRoleLabel(role)}
                </option>
              ))}
            </select>
          </label>

          <label className="pms-field">
            <span>Criado a partir de</span>
            <input type="date" value={draftFilters.createdFrom} onChange={(event) => updateDraftFilter("createdFrom", event.target.value)} className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Criado ate</span>
            <input type="date" value={draftFilters.createdTo} onChange={(event) => updateDraftFilter("createdTo", event.target.value)} className={viewFiltersFieldClassName} />
          </label>
        </div>
      }
    >
      {children}
    </EntityViewFilterableSection>
  );
}
