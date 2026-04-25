"use client";

import { useMemo } from "react";
import type { AdminSeason } from "@hotel/shared";
import { deleteSeasonAction, updateSeasonAction } from "../actions";
import { DEFAULT_SEASON_VIEW_FILTERS, applySeasonViewFilters, countAppliedSeasonFilters, type SeasonViewFilters } from "./seasonViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";

type SeasonsViewFilterableSectionProps = {
  seasons: AdminSeason[];
  canUpdate: boolean;
  canDelete: boolean;
  children?: React.ReactNode;
};

export function SeasonsViewFilterableSection({ seasons, canUpdate, canDelete, children }: SeasonsViewFilterableSectionProps) {
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
        <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
          <h3 className="m-0">{season.name}</h3>
          <p className="m-0 mt-[0.2rem] text-[#555]">
            {season.start_date} ate {season.end_date} | {season.is_active ? "ativa" : "inativa"}
          </p>

          {canUpdate ? (
            <form action={updateSeasonAction} className="mt-[0.65rem] grid gap-[0.45rem] md:grid-cols-3">
              <input type="hidden" name="id" value={season.id} />
              <input name="name" defaultValue={season.name} required className="pms-field-input" />
              <input name="start_date" type="date" defaultValue={season.start_date} required className="pms-field-input" />
              <input name="end_date" type="date" defaultValue={season.end_date} required className="pms-field-input" />
              <label className="flex items-center gap-2 text-[0.9rem]">
                <input name="is_active" type="checkbox" defaultChecked={season.is_active} /> Ativa
              </label>
              <button type="submit" className="justify-self-start rounded-lg border border-[#0f766e] bg-white px-[0.65rem] py-[0.45rem] text-[#0a5f58]">
                Salvar
              </button>
            </form>
          ) : null}

          {canDelete ? (
            <form action={deleteSeasonAction} className="mt-[0.45rem]">
              <input type="hidden" name="id" value={season.id} />
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