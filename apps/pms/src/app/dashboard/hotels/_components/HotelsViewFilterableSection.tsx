"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { AdminHotel } from "@hotel/shared";
import { HotelListItem } from "./HotelListItem";
import { DEFAULT_HOTEL_VIEW_FILTERS, applyHotelViewFilters, countAppliedHotelFilters, type HotelViewFilters } from "./hotelViewFilters";
import { ViewFiltersActionsBar, ViewFiltersModal, viewFiltersFieldStyle } from "../../_components/ViewFiltersBase";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<HotelViewFilters>(DEFAULT_HOTEL_VIEW_FILTERS);
  const [draftFilters, setDraftFilters] = useState<HotelViewFilters>(DEFAULT_HOTEL_VIEW_FILTERS);

  const appliedFilterCount = countAppliedHotelFilters(appliedFilters);

  const filteredHotels = useMemo(() => applyHotelViewFilters(hotels, appliedFilters), [hotels, appliedFilters]);

  const handleApply = () => {
    setAppliedFilters(draftFilters);
    setIsModalOpen(false);
  };

  const handleClear = () => {
    setAppliedFilters(DEFAULT_HOTEL_VIEW_FILTERS);
    setDraftFilters(DEFAULT_HOTEL_VIEW_FILTERS);
    setIsModalOpen(false);
  };

  const updateDraft = <K extends keyof HotelViewFilters>(key: K, value: HotelViewFilters[K]) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: value
    }));
  };

  return (
    <section style={{ display: "grid", gap: "0.85rem" }}>
      <ViewFiltersActionsBar
        appliedFilterCount={appliedFilterCount}
        onOpen={() => {
          setDraftFilters(appliedFilters);
          setIsModalOpen(true);
        }}
        onClear={handleClear}
      >
        {children}
      </ViewFiltersActionsBar>

      <p style={{ margin: 0, color: "#475467" }}>
        Exibindo {filteredHotels.length} de {hotels.length} hoteis.
      </p>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        {filteredHotels.length ? (
          filteredHotels.map((hotel) => (
            <HotelListItem
              key={hotel.id}
              hotel={hotel}
              canRead={canRead}
              canUpdate={canUpdate}
              canDelete={canDelete}
              isViewing={activeHotelId === hotel.id && mode === "view"}
              isEditing={activeHotelId === hotel.id && mode === "edit"}
            />
          ))
        ) : (
          <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem", color: "#666" }}>
            {appliedFilterCount ? "Nenhum hotel corresponde aos filtros aplicados." : "Nenhum hotel cadastrado ate o momento."}
          </article>
        )}
      </section>

      <ViewFiltersModal
        title="Filtros de hoteis"
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApply={handleApply}
        onClear={handleClear}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Nome ou slug</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraft("search", event.target.value)}
              placeholder="Ex.: centro ou hotel-centro"
              style={viewFiltersFieldStyle}
            />
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Status</span>
            <select value={draftFilters.status} onChange={(event) => updateDraft("status", event.target.value as HotelViewFilters["status"])} style={viewFiltersFieldStyle}>
              <option value="all">Todos</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Cidade</span>
            <input value={draftFilters.city} onChange={(event) => updateDraft("city", event.target.value)} placeholder="Ex.: Sao Paulo" style={viewFiltersFieldStyle} />
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Estado</span>
            <input value={draftFilters.state} onChange={(event) => updateDraft("state", event.target.value)} placeholder="Ex.: SP" style={viewFiltersFieldStyle} />
          </label>

          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Pais</span>
            <input value={draftFilters.country} onChange={(event) => updateDraft("country", event.target.value)} placeholder="Ex.: BR" style={viewFiltersFieldStyle} />
          </label>
        </div>
      </ViewFiltersModal>
    </section>
  );
}
