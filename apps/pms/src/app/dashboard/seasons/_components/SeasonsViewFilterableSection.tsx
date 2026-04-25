"use client";

import { useMemo } from "react";
import type { AdminSeason } from "@hotel/shared";
import { DEFAULT_SEASON_VIEW_FILTERS, applySeasonViewFilters, countAppliedSeasonFilters, type SeasonViewFilters } from "./seasonViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";
import { SeasonListItem } from "./SeasonListItem";

type SeasonsViewFilterableSectionProps = {
  seasons: AdminSeason[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  activeSeasonId: string;
  mode: "view" | "edit";
  children?: React.ReactNode;
};

export function SeasonsViewFilterableSection({ seasons, canRead, canUpdate, canDelete, activeSeasonId, mode, children }: SeasonsViewFilterableSectionProps) {
  const {
    isModalOpen,
    appliedFilters,
    draftFilters,
    openFilters,
    closeFilters,
    applyFilters,
    clearFilters,
    updateDraftFilter
  } = useViewFiltersState<SeasonViewFilters>(DEFAULT_SEASON_VIEW_FILTERS);

  const appliedFilterCount = countAppliedSeasonFilters(appliedFilters);
  const filteredSeasons = useMemo(() => applySeasonViewFilters(seasons, appliedFilters), [seasons, appliedFilters]);

  return (
    <EntityViewFilterableSection
      appliedFilterCount={appliedFilterCount}
      totalCount={seasons.length}
      filteredItems={filteredSeasons}
      itemLabelPlural="temporadas"
      filtersTitle="Filtros de temporadas"
      isModalOpen={isModalOpen}
      onOpenFilters={openFilters}
      onCloseFilters={closeFilters}
      onApplyFilters={applyFilters}
      onClearFilters={clearFilters}
      emptyMessage="Nenhuma temporada cadastrada ate o momento."
      filteredEmptyMessage="Nenhuma temporada corresponde aos filtros aplicados."
      getItemKey={(season) => season.id}
      renderItem={(season) => (
        <SeasonListItem
          season={season}
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={activeSeasonId === season.id && mode === "view"}
          isEditing={activeSeasonId === season.id && mode === "edit"}
        />
      )}
      filters={
        <div className="grid grid-cols-1 gap-[0.75rem] md:grid-cols-2 xl:grid-cols-4">
          <label className="pms-field">
            <span>Nome da temporada</span>
            <input value={draftFilters.search} onChange={(event) => updateDraftFilter("search", event.target.value)} placeholder="Ex.: alta temporada" className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Status</span>
            <select value={draftFilters.status} onChange={(event) => updateDraftFilter("status", event.target.value as SeasonViewFilters["status"])} className={viewFiltersFieldClassName}>
              <option value="all">Todas</option>
              <option value="active">Ativas</option>
              <option value="inactive">Inativas</option>
            </select>
          </label>

          <label className="pms-field">
            <span>Início a partir de</span>
            <input type="date" value={draftFilters.startFrom} onChange={(event) => updateDraftFilter("startFrom", event.target.value)} className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Início até</span>
            <input type="date" value={draftFilters.startTo} onChange={(event) => updateDraftFilter("startTo", event.target.value)} className={viewFiltersFieldClassName} />
          </label>
        </div>
      }
    >
      {children}
    </EntityViewFilterableSection>
  );
}