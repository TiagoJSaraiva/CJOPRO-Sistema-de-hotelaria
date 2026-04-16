"use client";

import { useMemo, useState, type ReactNode } from "react";
import { type AdminHotelOption, type AdminRoleOption, type AdminUser } from "@hotel/shared";
import { UserListItem } from "./UserListItem";
import { DEFAULT_USER_VIEW_FILTERS, applyUserViewFilters, countAppliedUserFilters, type UserViewFilters } from "./userViewFilters";
import { ViewFiltersActionsBar, ViewFiltersModal, viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
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
    <section className="grid gap-[0.85rem]">
      <ViewFiltersActionsBar appliedFilterCount={appliedFilterCount} onOpen={openModal} onClear={handleClearFilters}>
        {children}
      </ViewFiltersActionsBar>

      <p className="pms-status-muted">
        Exibindo {filteredUsers.length} de {users.length} usuarios.
      </p>

      <section className="grid gap-[0.75rem]">
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
          <article className="pms-empty-state">
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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[0.75rem]">
          <label className="pms-field">
            <span>Nome ou email</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraft("search", event.target.value)}
              placeholder="Ex.: maria ou hotel.com"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Status</span>
            <select
              value={draftFilters.status}
              onChange={(event) => updateDraft("status", event.target.value as UserViewFilters["status"])}
              className={viewFiltersFieldClassName}
            >
              <option value="all">Todos</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
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
            <span>Role</span>
            <select value={draftFilters.roleId} onChange={(event) => updateDraft("roleId", event.target.value)} className={viewFiltersFieldClassName}>
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
            <input type="date" value={draftFilters.createdFrom} onChange={(event) => updateDraft("createdFrom", event.target.value)} className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Criado ate</span>
            <input type="date" value={draftFilters.createdTo} onChange={(event) => updateDraft("createdTo", event.target.value)} className={viewFiltersFieldClassName} />
          </label>
        </div>
      </ViewFiltersModal>
    </section>
  );
}
