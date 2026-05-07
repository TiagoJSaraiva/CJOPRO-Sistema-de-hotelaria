"use client";

import type { AdminReservation } from "@hotel/shared";
import { translatePaymentStatus, translateReservationSource } from "@hotel/shared";
import { deleteReservationAction, updateReservationAction } from "../actions";
import { DashboardEntityActionButtons } from "../../_components/DashboardEntityActionButtons";
import { DashboardEntityListItemFrame } from "../../_components/DashboardEntityListItemFrame";

type ReservationListItemProps = {
  reservation: AdminReservation;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

function ReservationDataPreview({ reservation }: { reservation: AdminReservation }) {
  const createdAt = reservation.created_at ? new Date(reservation.created_at).toLocaleString("pt-BR") : "-";
  const updatedAt = reservation.updated_at ? new Date(reservation.updated_at).toLocaleString("pt-BR") : "-";

  return (
    <div className="mt-[0.85rem] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[0.75rem]">
      <div>
        <strong>Codigo:</strong>
        <p className="m-0 mt-[0.2rem]">{reservation.reservation_code}</p>
      </div>
      <div>
        <strong>Cliente:</strong>
        <p className="m-0 mt-[0.2rem]">{reservation.booking_customer_id}</p>
      </div>
      <div>
        <strong>Hospedes:</strong>
        <p className="m-0 mt-[0.2rem]">{reservation.guest_count}</p>
      </div>
      <div>
        <strong>Origem:</strong>
        <p className="m-0 mt-[0.2rem]">{translateReservationSource(reservation.reservation_source || "front_desk")}</p>
      </div>
      <div>
        <strong>Status de pagamento:</strong>
        <p className="m-0 mt-[0.2rem]">{translatePaymentStatus(reservation.payment_status || "pending")}</p>
      </div>
      <div>
        <strong>Total estimado:</strong>
        <p className="m-0 mt-[0.2rem]">R$ {(reservation.estimated_total_price || 0).toFixed(2)}</p>
      </div>
      <div>
        <strong>Total final:</strong>
        <p className="m-0 mt-[0.2rem]">R$ {(reservation.final_total_price || 0).toFixed(2)}</p>
      </div>
      <div>
        <strong>Criado em:</strong>
        <p className="m-0 mt-[0.2rem]">{createdAt}</p>
      </div>
      <div>
        <strong>Atualizado em:</strong>
        <p className="m-0 mt-[0.2rem]">{updatedAt}</p>
      </div>
      <div>
        <strong>Observacoes:</strong>
        <p className="m-0 mt-[0.2rem]">{reservation.notes || "-"}</p>
      </div>
    </div>
  );
}

function ReservationEditForm({ reservation }: { reservation: AdminReservation }) {
  return (
    <form action={updateReservationAction} className="mt-[0.85rem] grid gap-[0.65rem]">
      <input type="hidden" name="id" value={reservation.id} />

      <div className="pms-field">
        <label htmlFor={`reservation-booking-customer-${reservation.id}`}>Cliente (ID)</label>
        <input id={`reservation-booking-customer-${reservation.id}`} name="booking_customer_id" defaultValue={reservation.booking_customer_id} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-guest-count-${reservation.id}`}>Hospedes</label>
        <input id={`reservation-guest-count-${reservation.id}`} name="guest_count" type="number" min={1} defaultValue={reservation.guest_count} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-source-${reservation.id}`}>Origem</label>
        <select id={`reservation-source-${reservation.id}`} name="reservation_source" defaultValue={reservation.reservation_source || "front_desk"} className="pms-field-input">
          <option value="front_desk">{translateReservationSource("front_desk")}</option>
          <option value="website">{translateReservationSource("website")}</option>
          <option value="phone">{translateReservationSource("phone")}</option>
          <option value="agency">{translateReservationSource("agency")}</option>
        </select>
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-payment-status-${reservation.id}`}>Status do pagamento</label>
        <select id={`reservation-payment-status-${reservation.id}`} name="payment_status" defaultValue={reservation.payment_status || "pending"} className="pms-field-input">
          <option value="pending">{translatePaymentStatus("pending")}</option>
          <option value="partial">{translatePaymentStatus("partial")}</option>
          <option value="paid">{translatePaymentStatus("paid")}</option>
          <option value="refunded">{translatePaymentStatus("refunded")}</option>
        </select>
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-estimated-total-${reservation.id}`}>Total estimado</label>
        <input id={`reservation-estimated-total-${reservation.id}`} name="estimated_total_price" type="number" min={0} step="0.01" defaultValue={reservation.estimated_total_price || 0} className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-final-total-${reservation.id}`}>Total final</label>
        <input id={`reservation-final-total-${reservation.id}`} name="final_total_price" type="number" min={0} step="0.01" defaultValue={reservation.final_total_price || 0} className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-notes-${reservation.id}`}>Observacoes</label>
        <input id={`reservation-notes-${reservation.id}`} name="notes" defaultValue={reservation.notes || ""} className="pms-field-input" />
      </div>

      <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
        Salvar alteracoes
      </button>
    </form>
  );
}

export function ReservationListItem({ reservation, canRead, canUpdate, canDelete, isViewing, isEditing }: ReservationListItemProps) {
  const viewHref = `/dashboard/reservations/view?reservationId=${reservation.id}&mode=view`;
  const editHref = `/dashboard/reservations/view?reservationId=${reservation.id}&mode=edit`;

  return (
    <DashboardEntityListItemFrame
      title={`Reserva ${reservation.reservation_code}`}
      subtitle={`${reservation.guest_count} hospedes`}
      actions={
        <DashboardEntityActionButtons
          canRead={canRead}
          canUpdate={canUpdate}
          canDelete={canDelete}
          isViewing={isViewing}
          isEditing={isEditing}
          viewHref={viewHref}
          editHref={editHref}
          deleteId={reservation.id}
          deleteAction={deleteReservationAction}
        />
      }
    >
      {isViewing ? <ReservationDataPreview reservation={reservation} /> : null}
      {isEditing ? <ReservationEditForm reservation={reservation} /> : null}
    </DashboardEntityListItemFrame>
  );
}
