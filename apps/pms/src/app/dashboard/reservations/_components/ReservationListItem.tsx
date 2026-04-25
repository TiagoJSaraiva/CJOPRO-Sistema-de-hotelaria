"use client";

import Link from "next/link";
import type { AdminReservation } from "@hotel/shared";
import { deleteReservationAction, updateReservationAction } from "../actions";

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
        <strong>Check-in previsto:</strong>
        <p className="m-0 mt-[0.2rem]">{reservation.planned_checkin_date}</p>
      </div>
      <div>
        <strong>Check-out previsto:</strong>
        <p className="m-0 mt-[0.2rem]">{reservation.planned_checkout_date}</p>
      </div>
      <div>
        <strong>Hospedes:</strong>
        <p className="m-0 mt-[0.2rem]">{reservation.guest_count}</p>
      </div>
      <div>
        <strong>Status:</strong>
        <p className="m-0 mt-[0.2rem]">{reservation.reservation_status}</p>
      </div>
      <div>
        <strong>Origem:</strong>
        <p className="m-0 mt-[0.2rem]">{reservation.reservation_source || "-"}</p>
      </div>
      <div>
        <strong>Pagamento:</strong>
        <p className="m-0 mt-[0.2rem]">{reservation.payment_status}</p>
      </div>
      <div>
        <strong>Total estimado:</strong>
        <p className="m-0 mt-[0.2rem]">R$ {(reservation.estimated_total_amount || 0).toFixed(2)}</p>
      </div>
      <div>
        <strong>Total final:</strong>
        <p className="m-0 mt-[0.2rem]">R$ {(reservation.final_total_amount || 0).toFixed(2)}</p>
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
        <label htmlFor={`reservation-code-${reservation.id}`}>Codigo</label>
        <input id={`reservation-code-${reservation.id}`} name="reservation_code" defaultValue={reservation.reservation_code} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-checkin-${reservation.id}`}>Check-in previsto</label>
        <input id={`reservation-checkin-${reservation.id}`} name="planned_checkin_date" type="date" defaultValue={reservation.planned_checkin_date} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-checkout-${reservation.id}`}>Check-out previsto</label>
        <input id={`reservation-checkout-${reservation.id}`} name="planned_checkout_date" type="date" defaultValue={reservation.planned_checkout_date} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-guest-count-${reservation.id}`}>Hospedes</label>
        <input id={`reservation-guest-count-${reservation.id}`} name="guest_count" type="number" min={1} defaultValue={reservation.guest_count} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-status-${reservation.id}`}>Status da reserva</label>
        <select id={`reservation-status-${reservation.id}`} name="reservation_status" defaultValue={reservation.reservation_status} className="pms-field-input">
          <option value="pending">pending</option>
          <option value="confirmed">confirmed</option>
          <option value="checked_in">checked_in</option>
          <option value="checked_out">checked_out</option>
          <option value="canceled">canceled</option>
          <option value="no_show">no_show</option>
        </select>
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-source-${reservation.id}`}>Origem</label>
        <select id={`reservation-source-${reservation.id}`} name="reservation_source" defaultValue={reservation.reservation_source || "front_desk"} className="pms-field-input">
          <option value="front_desk">front_desk</option>
          <option value="website">website</option>
          <option value="phone">phone</option>
          <option value="agency">agency</option>
        </select>
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-payment-status-${reservation.id}`}>Status de pagamento</label>
        <select id={`reservation-payment-status-${reservation.id}`} name="payment_status" defaultValue={reservation.payment_status} className="pms-field-input">
          <option value="pending">pending</option>
          <option value="partial">partial</option>
          <option value="paid">paid</option>
          <option value="refunded">refunded</option>
        </select>
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-estimated-total-${reservation.id}`}>Total estimado</label>
        <input id={`reservation-estimated-total-${reservation.id}`} name="estimated_total_amount" type="number" min={0} step="0.01" defaultValue={reservation.estimated_total_amount || 0} className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`reservation-final-total-${reservation.id}`}>Total final</label>
        <input id={`reservation-final-total-${reservation.id}`} name="final_total_amount" type="number" min={0} step="0.01" defaultValue={reservation.final_total_amount || 0} className="pms-field-input" />
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
    <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="mb-[0.2rem] mt-0">Reserva {reservation.reservation_code}</h3>
          <p className="m-0 text-[#555]">{reservation.planned_checkin_date} ate {reservation.planned_checkout_date} | {reservation.reservation_status}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canRead ? (
            <Link
              href={viewHref}
              scroll={false}
              className={`rounded-lg border border-[#2d6cdf] px-[0.65rem] py-[0.45rem] no-underline ${
                isViewing ? "bg-[#e9f0ff] text-[#1b4db3]" : "bg-white text-[#1b4db3]"
              }`}
            >
              Visualizar dados
            </Link>
          ) : null}

          {canUpdate ? (
            <Link
              href={editHref}
              scroll={false}
              className={`rounded-lg border border-[#0f766e] px-[0.65rem] py-[0.45rem] no-underline ${
                isEditing ? "bg-[#ddf5f2] text-[#0a5f58]" : "bg-white text-[#0a5f58]"
              }`}
            >
              Editar dados
            </Link>
          ) : null}

          {canDelete ? (
            <form action={deleteReservationAction}>
              <input type="hidden" name="id" value={reservation.id} />
              <button type="submit" className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]">
                Apagar dados
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {isViewing ? <ReservationDataPreview reservation={reservation} /> : null}
      {isEditing ? <ReservationEditForm reservation={reservation} /> : null}
    </article>
  );
}