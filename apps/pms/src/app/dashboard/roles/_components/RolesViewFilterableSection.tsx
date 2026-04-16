"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ADMIN_ROLE_TYPES, type AdminHotelOption, type AdminPermissionOption, type AdminRole } from "@hotel/shared";
import { RoleListItem } from "./RoleListItem";
import { DEFAULT_ROLE_VIEW_FILTERS, applyRoleViewFilters, countAppliedRoleFilters, type RoleViewFilters } from "./roleViewFilters";
import { ViewFiltersActionsBar, ViewFiltersModal, viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<RoleViewFilters>(DEFAULT_ROLE_VIEW_FILTERS);
  const [draftFilters, setDraftFilters] = useState<RoleViewFilters>(DEFAULT_ROLE_VIEW_FILTERS);

  const appliedFilterCount = countAppliedRoleFilters(appliedFilters);

  const filteredRoles = useMemo(() => applyRoleViewFilters(roles, appliedFilters), [roles, appliedFilters]);

  const openModal = () => {
    setDraftFilters(appliedFilters);
    setIsModalOpen(true);
  };

  const handleApply = () => {
    setAppliedFilters(draftFilters);
    setIsModalOpen(false);
  };

  const handleClear = () => {
    setAppliedFilters(DEFAULT_ROLE_VIEW_FILTERS);
    setDraftFilters(DEFAULT_ROLE_VIEW_FILTERS);
    setIsModalOpen(false);
  };

  const updateDraft = <K extends keyof RoleViewFilters>(key: K, value: RoleViewFilters[K]) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: value
    }));
  };

  return (
    <section className="grid gap-[0.85rem]">
      <ViewFiltersActionsBar appliedFilterCount={appliedFilterCount} onOpen={openModal} onClear={handleClear}>
        {children}
      </ViewFiltersActionsBar>

      <p className="pms-status-muted">
        Exibindo {filteredRoles.length} de {roles.length} roles.
      </p>

      <section className="grid gap-[0.75rem]">
        {filteredRoles.length ? (
          filteredRoles.map((item) => (
            <RoleListItem
              key={item.id}
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
          ))
        ) : (
          <article className="pms-empty-state">
            {appliedFilterCount ? "Nenhuma role corresponde aos filtros aplicados." : "Nenhuma role cadastrada ate o momento."}
          </article>
        )}
      </section>

      <ViewFiltersModal
        title="Filtros de roles"
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApply={handleApply}
        onClear={handleClear}
      >
        <div className="grid grid-cols-1 gap-[0.75rem] md:grid-cols-2 xl:grid-cols-3">
          <label className="pms-field">
            <span>Nome da role</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraft("search", event.target.value)}
              placeholder="Ex.: admin"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Tipo da role</span>
            <select
              value={draftFilters.roleType}
              onChange={(event) => updateDraft("roleType", event.target.value as RoleViewFilters["roleType"])}
              className={viewFiltersFieldClassName}
            >
              <option value="">Todos</option>
              <option value={ADMIN_ROLE_TYPES.SYSTEM}>SYSTEM ROLE</option>
              <option value={ADMIN_ROLE_TYPES.HOTEL}>HOTEL ROLE</option>
            </select>
          </label>

          <label className="pms-field">
            <span>Hotel</span>
            <select value={draftFilters.hotelId} onChange={(event) => updateDraft("hotelId", event.target.value)} className={viewFiltersFieldClassName}>
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
            <select value={draftFilters.permissionId} onChange={(event) => updateDraft("permissionId", event.target.value)} className={viewFiltersFieldClassName}>
              <option value="">Todas</option>
              {permissions.map((permission) => (
                <option key={permission.id} value={permission.id}>
                  {permission.name} {permission.type === "SYSTEM_PERMISSION" ? "(SYSTEM)" : "(HOTEL)"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </ViewFiltersModal>
    </section>
  );
}
