"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { AdminPermission } from "@hotel/shared";
import { PermissionListItem } from "./PermissionListItem";
import {
  DEFAULT_PERMISSION_VIEW_FILTERS,
  applyPermissionViewFilters,
  countAppliedPermissionFilters,
  type PermissionViewFilters
} from "./permissionViewFilters";
import { ViewFiltersActionsBar, ViewFiltersModal, viewFiltersFieldStyle } from "../../_components/ViewFiltersBase";

type PermissionsViewFilterableSectionProps = {
  permissions: AdminPermission[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  activePermissionId: string;
  mode: "view" | "edit";
  children?: ReactNode;
};

export function PermissionsViewFilterableSection({
  permissions,
  canRead,
  canUpdate,
  canDelete,
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
    <section style={{ display: "grid", gap: "0.85rem" }}>
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

      <p style={{ margin: 0, color: "#475467" }}>
        Exibindo {filteredPermissions.length} de {permissions.length} permissoes.
      </p>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        {filteredPermissions.length ? (
          filteredPermissions.map((item) => (
            <PermissionListItem
              key={item.id}
              permissionItem={item}
              canRead={canRead}
              canUpdate={canUpdate}
              canDelete={canDelete}
              isViewing={activePermissionId === item.id && mode === "view"}
              isEditing={activePermissionId === item.id && mode === "edit"}
            />
          ))
        ) : (
          <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem", color: "#666" }}>
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
        <label style={{ display: "grid", gap: "0.35rem" }}>
          <span>Nome da permissao</span>
          <input
            value={draftFilters.search}
            onChange={(event) => setDraftFilters({ search: event.target.value })}
            placeholder="Ex.: USER_READ"
            style={viewFiltersFieldStyle}
          />
        </label>
      </ViewFiltersModal>
    </section>
  );
}
