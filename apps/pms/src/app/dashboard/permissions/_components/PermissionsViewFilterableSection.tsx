"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ADMIN_PERMISSION_TYPES, type AdminPermission } from "@hotel/shared";
import { PermissionListItem } from "./PermissionListItem";
import {
  DEFAULT_PERMISSION_VIEW_FILTERS,
  applyPermissionViewFilters,
  countAppliedPermissionFilters,
  type PermissionViewFilters
} from "./permissionViewFilters";
import { ViewFiltersActionsBar, ViewFiltersModal, viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<PermissionViewFilters>(DEFAULT_PERMISSION_VIEW_FILTERS);
  const [draftFilters, setDraftFilters] = useState<PermissionViewFilters>(DEFAULT_PERMISSION_VIEW_FILTERS);

  const appliedFilterCount = countAppliedPermissionFilters(appliedFilters);

  const filteredPermissions = useMemo(
    () => applyPermissionViewFilters(permissions, appliedFilters),
    [permissions, appliedFilters]
  );

  const handleApply = () => {
    setAppliedFilters(draftFilters);
    setIsModalOpen(false);
  };

  const handleClear = () => {
    setAppliedFilters(DEFAULT_PERMISSION_VIEW_FILTERS);
    setDraftFilters(DEFAULT_PERMISSION_VIEW_FILTERS);
    setIsModalOpen(false);
  };

  return (
    <section className="grid gap-[0.85rem]">
      <ViewFiltersActionsBar
        appliedFilterCount={appliedFilterCount}
        onOpen={() => {
          setDraftFilters(appliedFilters);
          setIsModalOpen(true);
        }}
        onClear={handleClear}
      >
        {children}
      </ViewFiltersActionsBar>

      <p className="pms-status-muted">
        Exibindo {filteredPermissions.length} de {permissions.length} permissoes.
      </p>

      <section className="grid gap-[0.75rem]">
        {filteredPermissions.length ? (
          filteredPermissions.map((item) => (
            <PermissionListItem
              key={item.id}
              permissionItem={item}
              canRead={canRead}
              canUpdate={canUpdate}
              canDelete={canDelete}
              isCurrentUserPermission={currentUserPermissionNames.includes(item.name)}
              isViewing={activePermissionId === item.id && mode === "view"}
              isEditing={activePermissionId === item.id && mode === "edit"}
            />
          ))
        ) : (
          <article className="pms-empty-state">
            {appliedFilterCount ? "Nenhuma permissao corresponde aos filtros aplicados." : "Nenhuma permissao cadastrada ate o momento."}
          </article>
        )}
      </section>

      <ViewFiltersModal
        title="Filtros de permissoes"
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApply={handleApply}
        onClear={handleClear}
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[0.75rem]">
          <label className="pms-field">
            <span>Nome da permissao</span>
            <input
              value={draftFilters.search}
              onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Ex.: USER_READ"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Tipo</span>
            <select
              value={draftFilters.type}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  type: event.target.value as "" | "SYSTEM_PERMISSION" | "HOTEL_PERMISSION"
                }))
              }
              className={viewFiltersFieldClassName}
            >
              <option value="">Todos</option>
              <option value={ADMIN_PERMISSION_TYPES.SYSTEM}>SYSTEM PERMISSION</option>
              <option value={ADMIN_PERMISSION_TYPES.HOTEL}>HOTEL PERMISSION</option>
            </select>
          </label>
        </div>
      </ViewFiltersModal>
    </section>
  );
}
