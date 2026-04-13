"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { AdminHotelOption, AdminRoleOption, AdminUser } from "@hotel/shared";
import { UserListItem } from "./UserListItem";
import { DEFAULT_USER_VIEW_FILTERS, applyUserViewFilters, countAppliedUserFilters, type UserViewFilters } from "./userViewFilters";
import { ViewFiltersActionsBar, ViewFiltersModal, viewFiltersFieldStyle } from "../../_components/ViewFiltersBase";

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
  return `${role.name} (${role.hotel_name || "GLOBAL"})`;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<UserViewFilters>(DEFAULT_USER_VIEW_FILTERS);
  const [draftFilters, setDraftFilters] = useState<UserViewFilters>(DEFAULT_USER_VIEW_FILTERS);

  const appliedFilterCount = countAppliedUserFilters(appliedFilters);

  const filteredUsers = useMemo(() => applyUserViewFilters(users, appliedFilters), [users, appliedFilters]);

  const openModal = () => {
    setDraftFilters(appliedFilters);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
    setIsModalOpen(false);
  };

  const handleClearFilters = () => {
    setAppliedFilters(DEFAULT_USER_VIEW_FILTERS);
    setDraftFilters(DEFAULT_USER_VIEW_FILTERS);
    setIsModalOpen(false);
  };

  const updateDraft = <K extends keyof UserViewFilters>(key: K, value: UserViewFilters[K]) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: value
    }));
  };

  return (
    <section style={{ display: "grid", gap: "0.85rem" }}>
      <ViewFiltersActionsBar appliedFilterCount={appliedFilterCount} onOpen={openModal} onClear={handleClearFilters}>
        {children}
      </ViewFiltersActionsBar>

      <p style={{ margin: 0, color: "#475467" }}>
        Exibindo {filteredUsers.length} de {users.length} usuarios.
      </p>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        {filteredUsers.length ? (
          filteredUsers.map((item) => (
            <UserListItem
              key={item.id}
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
          ))
        ) : (
          <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem", color: "#666" }}>
            {appliedFilterCount ? "Nenhum usuario corresponde aos filtros aplicados." : "Nenhum usuario cadastrado ate o momento."}
          </article>
        )}
      </section>

      <ViewFiltersModal
        title="Filtros de usuarios"
        open={isModalOpen}
        onClose={closeModal}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Nome ou email</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraft("search", event.target.value)}
              placeholder="Ex.: maria ou hotel.com"
              style={viewFiltersFieldStyle}
            />
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Status</span>
            <select value={draftFilters.status} onChange={(event) => updateDraft("status", event.target.value as UserViewFilters["status"])} style={viewFiltersFieldStyle}>
              <option value="all">Todos</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
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
            <span>Role</span>
            <select value={draftFilters.roleId} onChange={(event) => updateDraft("roleId", event.target.value)} style={viewFiltersFieldStyle}>
              <option value="">Todas</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {getRoleLabel(role)}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Criado a partir de</span>
            <input type="date" value={draftFilters.createdFrom} onChange={(event) => updateDraft("createdFrom", event.target.value)} style={viewFiltersFieldStyle} />
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Criado ate</span>
            <input type="date" value={draftFilters.createdTo} onChange={(event) => updateDraft("createdTo", event.target.value)} style={viewFiltersFieldStyle} />
          </label>
        </div>
      </ViewFiltersModal>
    </section>
  );
}
