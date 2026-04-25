"use client";

import { useMemo } from "react";
import type { AdminReservation } from "@hotel/shared";
import {
  DEFAULT_RESERVATION_VIEW_FILTERS,
  applyReservationViewFilters,
  countAppliedReservationFilters,
  type ReservationViewFilters
} from "./reservationViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";
import { ReservationListItem } from "./ReservationListItem";

type ReservationsViewFilterableSectionProps = {
  reservations: AdminReservation[];
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  activeReservationId: string;
  mode: "view" | "edit";
  children?: React.ReactNode;
};

export function ReservationsViewFilterableSection({ reservations, canRead, canUpdate, canDelete, activeReservationId, mode, children }: ReservationsViewFilterableSectionProps) {
  const {
    isModalOpen,
    appliedFilters,
    draftFilters,
    openFilters,
    closeFilters,
    applyFilters,
    clearFilters,
    updateDraftFilter
  } = useViewFiltersState<ReservationViewFilters>(DEFAULT_RESERVATION_VIEW_FILTERS);

  const appliedFilterCount = countAppliedReservationFilters(appliedFilters);
  const filteredReservations = useMemo(() => applyReservationViewFilters(reservations, appliedFilters), [reservations, appliedFilters]);

  return (
    <EntityViewFilterableSection
      appliedFilterCount={appliedFilterCount}
      totalCount={reservations.length}
      filteredItems={filteredReservations}
      itemLabelPlural="reservas"
      filtersTitle="Filtros de reservas"
      isModalOpen={isModalOpen}
      onOpenFilters={openFilters}
      onCloseFilters={closeFilters}
      onApplyFilters={applyFilters}
      onClearFilters={clearFilters}
      emptyMessage="Nenhuma reserva cadastrada ate o momento."
      filteredEmptyMessage="Nenhuma reserva corresponde aos filtros aplicados."
      getItemKey={(reservation) => reservation.id}
      renderItem={(item) => (
        <ReservationListItem
          reservation={item}
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={activeReservationId === item.id && mode === "view"}
          isEditing={activeReservationId === item.id && mode === "edit"}
        />
      )}
      filters={
        <div className="grid grid-cols-1 gap-[0.75rem] md:grid-cols-2 xl:grid-cols-3">
          <label className="pms-field">
            <span>Código, cliente ou observações</span>
            <input
              value={draftFilters.search}
              onChange={(event) => updateDraftFilter("search", event.target.value)}
              placeholder="Ex.: RES-2026, cliente, observações"
              className={viewFiltersFieldClassName}
            />
          </label>

          <label className="pms-field">
            <span>Status da reserva</span>
            <select value={draftFilters.status} onChange={(event) => updateDraftFilter("status", event.target.value as ReservationViewFilters["status"])} className={viewFiltersFieldClassName}>
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="confirmed">Confirmada</option>
              <option value="checked_in">Check-in</option>
              <option value="checked_out">Check-out</option>
              <option value="canceled">Cancelada</option>
              <option value="no_show">No show</option>
            </select>
          </label>

          <label className="pms-field">
            <span>Status de pagamento</span>
            <select value={draftFilters.paymentStatus} onChange={(event) => updateDraftFilter("paymentStatus", event.target.value as ReservationViewFilters["paymentStatus"])} className={viewFiltersFieldClassName}>
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="partial">Parcial</option>
              <option value="paid">Pago</option>
              <option value="refunded">Reembolsado</option>
            </select>
          </label>

          <label className="pms-field">
            <span>Origem</span>
            <select value={draftFilters.source} onChange={(event) => updateDraftFilter("source", event.target.value as ReservationViewFilters["source"])} className={viewFiltersFieldClassName}>
              <option value="all">Todas</option>
              <option value="front_desk">front_desk</option>
              <option value="website">website</option>
              <option value="phone">phone</option>
              <option value="agency">agency</option>
            </select>
          </label>

          <label className="pms-field">
            <span>Check-in a partir de</span>
            <input type="date" value={draftFilters.plannedCheckinFrom} onChange={(event) => updateDraftFilter("plannedCheckinFrom", event.target.value)} className={viewFiltersFieldClassName} />
          </label>

          <label className="pms-field">
            <span>Check-in até</span>
            <input type="date" value={draftFilters.plannedCheckinTo} onChange={(event) => updateDraftFilter("plannedCheckinTo", event.target.value)} className={viewFiltersFieldClassName} />
          </label>
        </div>
      }
    >
      {children}
    </EntityViewFilterableSection>
  );
}