"use client";

import { useMemo } from "react";
import type { AdminSeasonRoomRate } from "@hotel/shared";
import {
  DEFAULT_SEASON_ROOM_RATE_VIEW_FILTERS,
  applySeasonRoomRateViewFilters,
  countAppliedSeasonRoomRateFilters,
  type SeasonRoomRateViewFilters
} from "./seasonRoomRateViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";
import { SeasonRoomRateListItem } from "./SeasonRoomRateListItem";

type SeasonRoomRatesViewFilterableSectionProps = {
  items: AdminSeasonRoomRate[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  activeSeasonRoomRateId: string;
  mode: "view" | "edit";
  children?: React.ReactNode;
};

export function SeasonRoomRatesViewFilterableSection({ items, canRead, canUpdate, canDelete, activeSeasonRoomRateId, mode, children }: SeasonRoomRatesViewFilterableSectionProps) {
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
        <SeasonRoomRateListItem
          item={item}
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={activeSeasonRoomRateId === item.id && mode === "view"}
          isEditing={activeSeasonRoomRateId === item.id && mode === "edit"}
        />
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