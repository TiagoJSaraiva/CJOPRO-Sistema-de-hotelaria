"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { AdminHotelOption, AdminPermissionOption, AdminRole } from "@hotel/shared";
import { RoleListItem } from "./RoleListItem";
import { DEFAULT_ROLE_VIEW_FILTERS, applyRoleViewFilters, countAppliedRoleFilters, type RoleViewFilters } from "./roleViewFilters";
import { ViewFiltersActionsBar, ViewFiltersModal, viewFiltersFieldStyle } from "../../_components/ViewFiltersBase";

type RolesViewFilterableSectionProps = {
  roles: AdminRole[];
  hotels: AdminHotelOption[];
  permissions: AdminPermissionOption[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
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
    <section style={{ display: "grid", gap: "0.85rem" }}>
      <ViewFiltersActionsBar appliedFilterCount={appliedFilterCount} onOpen={openModal} onClear={handleClear}>
        {children}
      </ViewFiltersActionsBar>

      <p style={{ margin: 0, color: "#475467" }}>
        Exibindo {filteredRoles.length} de {roles.length} roles.
      </p>

      <section style={{ display: "grid", gap: "0.75rem" }}>
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
              isViewing={activeRoleId === item.id && mode === "view"}
              isEditing={activeRoleId === item.id && mode === "edit"}
            />
          ))
        ) : (
          <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem", color: "#666" }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Nome da role</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraft("search", event.target.value)}
              placeholder="Ex.: admin"
              style={viewFiltersFieldStyle}
            />
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Hotel</span>
            <select value={draftFilters.hotelId} onChange={(event) => updateDraft("hotelId", event.target.value)} style={viewFiltersFieldStyle}>
              <option value="">Todos</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Permissao vinculada</span>
            <select value={draftFilters.permissionId} onChange={(event) => updateDraft("permissionId", event.target.value)} style={viewFiltersFieldStyle}>
              <option value="">Todas</option>
              {permissions.map((permission) => (
                <option key={permission.id} value={permission.id}>
                  {permission.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </ViewFiltersModal>
    </section>
  );
}
