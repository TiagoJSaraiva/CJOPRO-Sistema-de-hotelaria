"use client";

import { useMemo } from "react";
import type { AdminRoom } from "@hotel/shared";
import { DEFAULT_ROOM_VIEW_FILTERS, applyRoomViewFilters, countAppliedRoomFilters, type RoomViewFilters } from "./roomViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";
import { RoomListItem } from "./RoomListItem";

type RoomsViewFilterableSectionProps = {
  rooms: AdminRoom[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  activeRoomId: string;
  mode: "view" | "edit";
  children?: React.ReactNode;
};

export function RoomsViewFilterableSection({ rooms, canRead, canUpdate, canDelete, activeRoomId, mode, children }: RoomsViewFilterableSectionProps) {
  const {
    isModalOpen,
    appliedFilters,
    draftFilters,
    openFilters,
    closeFilters,
    applyFilters,
    clearFilters,
    updateDraftFilter
  } = useViewFiltersState<RoomViewFilters>(DEFAULT_ROOM_VIEW_FILTERS);

  const appliedFilterCount = countAppliedRoomFilters(appliedFilters);
  const filteredRooms = useMemo(() => applyRoomViewFilters(rooms, appliedFilters), [rooms, appliedFilters]);

  return (
    <EntityViewFilterableSection
      appliedFilterCount={appliedFilterCount}
      totalCount={rooms.length}
      filteredItems={filteredRooms}
      itemLabelPlural="quartos"
      filtersTitle="Filtros de quartos"
      isModalOpen={isModalOpen}
      onOpenFilters={openFilters}
      onCloseFilters={closeFilters}
      onApplyFilters={applyFilters}
      onClearFilters={clearFilters}
      emptyMessage="Nenhum quarto cadastrado ate o momento."
      filteredEmptyMessage="Nenhum quarto corresponde aos filtros aplicados."
      getItemKey={(room) => room.id}
      renderItem={(room) => (
        <RoomListItem
          room={room}
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={activeRoomId === room.id && mode === "view"}
          isEditing={activeRoomId === room.id && mode === "edit"}
        />
      )}
      filters={
        <div className="grid grid-cols-1 gap-[0.75rem] md:grid-cols-2 xl:grid-cols-4">
          <label className="pms-field">
            <span>Número, tipo ou observações</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraftFilter("search", event.target.value)}
              placeholder="Ex.: 101, suite, vista"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Status</span>
            <select
              value={draftFilters.status}
              onChange={(event) => updateDraftFilter("status", event.target.value as RoomViewFilters["status"])}
              className={viewFiltersFieldClassName}
            >
              <option value="all">Todos</option>
              <option value="available">Disponível</option>
              <option value="occupied">Ocupado</option>
              <option value="maintenance">Manutenção</option>
              <option value="blocked">Bloqueado</option>
            </select>
          </label>

          <label className="pms-field">
            <span>Capacidade mínima</span>
            <input
              value={draftFilters.minOccupancy}
              onChange={(event) => updateDraftFilter("minOccupancy", event.target.value)}
              type="number"
              min={0}
              placeholder="Ex.: 2"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Capacidade máxima</span>
            <input
              value={draftFilters.maxOccupancy}
              onChange={(event) => updateDraftFilter("maxOccupancy", event.target.value)}
              type="number"
              min={0}
              placeholder="Ex.: 4"
              className={viewFiltersFieldClassName}
            />
          </label>
        </div>
      }
    >
      {children}
    </EntityViewFilterableSection>
  );
}