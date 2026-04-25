"use client";

import { useMemo } from "react";
import type { AdminReservation } from "@hotel/shared";
import { deleteReservationAction, updateReservationAction } from "../actions";
import {
  DEFAULT_RESERVATION_VIEW_FILTERS,
  applyReservationViewFilters,
  countAppliedReservationFilters,
  type ReservationViewFilters
} from "./reservationViewFilters";
import { viewFiltersFieldClassName } from "../../_components/ViewFiltersBase";
import { EntityViewFilterableSection } from "../../_components/EntityViewFilterableSection";
import { useViewFiltersState } from "../../_components/useViewFiltersState";

type ReservationsViewFilterableSectionProps = {
  reservations: AdminReservation[];
  canUpdate: boolean;
  canDelete: boolean;
  children?: React.ReactNode;
};

export function ReservationsViewFilterableSection({ reservations, canUpdate, canDelete, children }: ReservationsViewFilterableSectionProps) {
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
        <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
          <h3 className="m-0">Reserva {item.reservation_code}</h3>
          <p className="m-0 mt-[0.2rem] text-[#555]">
            {item.planned_checkin_date} ate {item.planned_checkout_date} | {item.reservation_status}
          </p>

          {canUpdate ? (
            <form action={updateReservationAction} className="mt-[0.65rem] grid gap-[0.45rem] md:grid-cols-3">
              <input type="hidden" name="id" value={item.id} />
              <input name="booking_customer_id" defaultValue={item.booking_customer_id} required className="pms-field-input" />
              <input name="reservation_code" defaultValue={item.reservation_code} required className="pms-field-input" />
              <input name="planned_checkin_date" type="date" defaultValue={item.planned_checkin_date} required className="pms-field-input" />
              <input name="planned_checkout_date" type="date" defaultValue={item.planned_checkout_date} required className="pms-field-input" />
              <input name="guest_count" type="number" min={1} defaultValue={item.guest_count} required className="pms-field-input" />
              <select name="reservation_status" defaultValue={item.reservation_status} className="pms-field-input">
                <option value="pending">pending</option>
                <option value="confirmed">confirmed</option>
                <option value="checked_in">checked_in</option>
                <option value="checked_out">checked_out</option>
                <option value="canceled">canceled</option>
                <option value="no_show">no_show</option>
              </select>
              <select name="reservation_source" defaultValue={item.reservation_source || "front_desk"} className="pms-field-input">
                <option value="front_desk">front_desk</option>
                <option value="website">website</option>
                <option value="phone">phone</option>
                <option value="agency">agency</option>
              </select>
              <select name="payment_status" defaultValue={item.payment_status} className="pms-field-input">
                <option value="pending">pending</option>
                <option value="partial">partial</option>
                <option value="paid">paid</option>
                <option value="refunded">refunded</option>
              </select>
              <input name="estimated_total_amount" type="number" min={0} step="0.01" defaultValue={item.estimated_total_amount || 0} className="pms-field-input" />
              <input name="final_total_amount" type="number" min={0} step="0.01" defaultValue={item.final_total_amount || 0} className="pms-field-input" />
              <input name="notes" defaultValue={item.notes || ""} className="pms-field-input" />
              <button type="submit" className="justify-self-start rounded-lg border border-[#0f766e] bg-white px-[0.65rem] py-[0.45rem] text-[#0a5f58]">
                Salvar
              </button>
            </form>
          ) : null}

          {canDelete ? (
            <form action={deleteReservationAction} className="mt-[0.45rem]">
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]">
                Apagar
              </button>
            </form>
          ) : null}
        </article>
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