"use client";

import { useMemo } from "react";
import type { AdminRoom } from "@hotel/shared";
import { deleteRoomAction, updateRoomAction } from "../actions";
import { DEFAULT_ROOM_VIEW_FILTERS, applyRoomViewFilters, countAppliedRoomFilters, type RoomViewFilters } from "./roomViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";

type RoomsViewFilterableSectionProps = {
  rooms: AdminRoom[];
  canUpdate: boolean;
  canDelete: boolean;
  children?: React.ReactNode;
};

export function RoomsViewFilterableSection({ rooms, canUpdate, canDelete, children }: RoomsViewFilterableSectionProps) {
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
        <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
          <h3 className="m-0">Quarto {room.room_number}</h3>
          <p className="m-0 mt-[0.2rem] text-[#555]">Tipo: {room.room_type} | Status: {room.status}</p>

          {canUpdate ? (
            <form action={updateRoomAction} className="mt-[0.65rem] grid gap-[0.45rem] md:grid-cols-3">
              <input type="hidden" name="id" value={room.id} />
              <input name="room_number" defaultValue={room.room_number} required className="pms-field-input" />
              <input name="room_type" defaultValue={room.room_type} required className="pms-field-input" />
              <input name="max_occupancy" type="number" min={1} defaultValue={room.max_occupancy} required className="pms-field-input" />
              <input name="base_daily_rate" type="number" min={0} step="0.01" defaultValue={room.base_daily_rate} required className="pms-field-input" />
              <select name="status" defaultValue={room.status} className="pms-field-input">
                <option value="available">available</option>
                <option value="occupied">occupied</option>
                <option value="maintenance">maintenance</option>
                <option value="blocked">blocked</option>
              </select>
              <input name="notes" defaultValue={room.notes || ""} className="pms-field-input" />
              <button type="submit" className="justify-self-start rounded-lg border border-[#0f766e] bg-white px-[0.65rem] py-[0.45rem] text-[#0a5f58]">
                Salvar
              </button>
            </form>
          ) : null}

          {canDelete ? (
            <form action={deleteRoomAction} className="mt-[0.45rem]">
              <input type="hidden" name="id" value={room.id} />
              <button type="submit" className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]">
                Apagar
              </button>
            </form>
          ) : null}
        </article>
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