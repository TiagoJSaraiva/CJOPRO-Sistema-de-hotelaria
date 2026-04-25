"use client";

import { useMemo } from "react";
import type { AdminSeasonRoomRate } from "@hotel/shared";
import { deleteSeasonRoomRateAction, updateSeasonRoomRateAction } from "../actions";
import {
  DEFAULT_SEASON_ROOM_RATE_VIEW_FILTERS,
  applySeasonRoomRateViewFilters,
  countAppliedSeasonRoomRateFilters,
  type SeasonRoomRateViewFilters
} from "./seasonRoomRateViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";

type SeasonRoomRatesViewFilterableSectionProps = {
  items: AdminSeasonRoomRate[];
  canUpdate: boolean;
  canDelete: boolean;
  children?: React.ReactNode;
};

export function SeasonRoomRatesViewFilterableSection({ items, canUpdate, canDelete, children }: SeasonRoomRatesViewFilterableSectionProps) {
  const {
    isModalOpen,
    appliedFilters,
    draftFilters,
    openFilters,
    closeFilters,
    applyFilters,
    clearFilters,
    updateDraftFilter
  } = useViewFiltersState<SeasonRoomRateViewFilters>(DEFAULT_SEASON_ROOM_RATE_VIEW_FILTERS);

  const appliedFilterCount = countAppliedSeasonRoomRateFilters(appliedFilters);
  const filteredItems = useMemo(() => applySeasonRoomRateViewFilters(items, appliedFilters), [items, appliedFilters]);

  return (
    <EntityViewFilterableSection
      appliedFilterCount={appliedFilterCount}
      totalCount={items.length}
      filteredItems={filteredItems}
      itemLabelPlural="tarifas"
      filtersTitle="Filtros de tarifas por temporada"
      isModalOpen={isModalOpen}
      onOpenFilters={openFilters}
      onCloseFilters={closeFilters}
      onApplyFilters={applyFilters}
      onClearFilters={clearFilters}
      emptyMessage="Nenhuma tarifa por temporada cadastrada ate o momento."
      filteredEmptyMessage="Nenhuma tarifa por temporada corresponde aos filtros aplicados."
      getItemKey={(item) => item.id}
      renderItem={(item) => (
        <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
          <h3 className="m-0">{item.room_type}</h3>
          <p className="m-0 mt-[0.2rem] text-[#555]">Season: {item.season_id} | R$ {item.daily_rate.toFixed(2)}</p>

          {canUpdate ? (
            <form action={updateSeasonRoomRateAction} className="mt-[0.65rem] grid gap-[0.45rem] md:grid-cols-3">
              <input type="hidden" name="id" value={item.id} />
              <input name="season_id" defaultValue={item.season_id} required className="pms-field-input" />
              <input name="room_type" defaultValue={item.room_type} required className="pms-field-input" />
              <input name="daily_rate" type="number" min={0} step="0.01" defaultValue={item.daily_rate} required className="pms-field-input" />
              <button type="submit" className="justify-self-start rounded-lg border border-[#0f766e] bg-white px-[0.65rem] py-[0.45rem] text-[#0a5f58]">
                Salvar
              </button>
            </form>
          ) : null}

          {canDelete ? (
            <form action={deleteSeasonRoomRateAction} className="mt-[0.45rem]">
              <input type="hidden" name="id" value={item.id} />
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
            <span>Room type ou season id</span>
            <input value={draftFilters.search} onChange={(event) => updateDraftFilter("search", event.target.value)} placeholder="Ex.: suite, season-1" className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Season ID</span>
            <input value={draftFilters.seasonId} onChange={(event) => updateDraftFilter("seasonId", event.target.value)} placeholder="Ex.: season-1" className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Diária mínima</span>
            <input type="number" min={0} step="0.01" value={draftFilters.minRate} onChange={(event) => updateDraftFilter("minRate", event.target.value)} className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Diária máxima</span>
            <input type="number" min={0} step="0.01" value={draftFilters.maxRate} onChange={(event) => updateDraftFilter("maxRate", event.target.value)} className={viewFiltersFieldClassName} />
          </label>
        </div>
      }
    >
      {children}
    </EntityViewFilterableSection>
  );
}