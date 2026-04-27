"use client";

import { useMemo, type ReactNode } from "react";
import type { AdminHotel } from "@hotel/shared";
import { HotelListItem } from "./HotelListItem";
import { DEFAULT_HOTEL_VIEW_FILTERS, applyHotelViewFilters, countAppliedHotelFilters, type HotelViewFilters } from "./hotelViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";

type HotelsViewFilterableSectionProps = {
  hotels: AdminHotel[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  activeHotelId: string;
  mode: "view" | "edit";
  children?: ReactNode;
};

export function HotelsViewFilterableSection({ hotels, canRead, canUpdate, canDelete, activeHotelId, mode, children }: HotelsViewFilterableSectionProps) {
  const {
    isModalOpen,
    appliedFilters,
    draftFilters,
    openFilters,
    closeFilters,
    applyFilters,
    clearFilters,
    updateDraftFilter
  } = useViewFiltersState<HotelViewFilters>(DEFAULT_HOTEL_VIEW_FILTERS);

  const appliedFilterCount = countAppliedHotelFilters(appliedFilters);

  const filteredHotels = useMemo(() => applyHotelViewFilters(hotels, appliedFilters), [hotels, appliedFilters]);

  return (
    <EntityViewFilterableSection
      appliedFilterCount={appliedFilterCount}
      totalCount={hotels.length}
      filteredItems={filteredHotels}
      itemLabelPlural="hoteis"
      filtersTitle="Filtros de hoteis"
      isModalOpen={isModalOpen}
      onOpenFilters={openFilters}
      onCloseFilters={closeFilters}
      onApplyFilters={applyFilters}
      onClearFilters={clearFilters}
      emptyMessage="Nenhum hotel cadastrado ate o momento."
      filteredEmptyMessage="Nenhum hotel corresponde aos filtros aplicados."
      getItemKey={(hotel) => hotel.id}
      renderItem={(hotel) => (
        <HotelListItem
          hotel={hotel}
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={activeHotelId === hotel.id && mode === "view"}
          isEditing={activeHotelId === hotel.id && mode === "edit"}
        />
      )}
      filters={
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[0.75rem]">
          <label className="pms-field">
            <span>Nome ou slug</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraftFilter("search", event.target.value)}
              placeholder="Ex.: centro ou hotel-centro"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Status</span>
            <select
              value={draftFilters.status}
              onChange={(event) => updateDraftFilter("status", event.target.value as HotelViewFilters["status"])}
              className={viewFiltersFieldClassName}
            >
              <option value="all">Todos</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>

          <label className="pms-field">
            <span>Cidade</span>
            <input value={draftFilters.city} onChange={(event) => updateDraftFilter("city", event.target.value)} placeholder="Ex.: Sao Paulo" className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Estado</span>
            <input value={draftFilters.state} onChange={(event) => updateDraftFilter("state", event.target.value)} placeholder="Ex.: SP" className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Pais</span>
            <input value={draftFilters.country} onChange={(event) => updateDraftFilter("country", event.target.value)} placeholder="Ex.: BR" className={viewFiltersFieldClassName} />
          </label>
        </div>
      }
    >
      {children}
    </EntityViewFilterableSection>
  );
}
