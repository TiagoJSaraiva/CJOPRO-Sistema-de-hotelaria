import { getUserFromSession } from "../../../lib/auth";
import { listReservations } from "../../../lib/adminApi";
import { getReservationsAccess } from "./access";
import { createReservationAction, deleteReservationAction, updateReservationAction } from "./actions";

type ReservationsPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function ReservationsPage({ searchParams }: ReservationsPageProps) {
  const user = await getUserFromSession();
  const access = getReservationsAccess(user);

  if (!access.canRead && !access.canCreate) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Reservas</h1>
        <p>Sem permissao para acessar este modulo.</p>
      </section>
    );
  }

  const reservations = access.canRead ? await listReservations() : [];

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Reservas</h1>
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      {access.canCreate ? (
        <article className="pms-surface-card">
          <h3 className="mt-0">Criar reserva</h3>
          <form key={searchParams?.r} action={createReservationAction} className="grid gap-[0.65rem] md:grid-cols-2">
            <input name="booking_customer_id" placeholder="Booking customer ID" required className="pms-field-input" />
            <input name="reservation_code" placeholder="Codigo da reserva" required className="pms-field-input" />
            <input name="planned_checkin_date" type="date" required className="pms-field-input" />
            <input name="planned_checkout_date" type="date" required className="pms-field-input" />
            <input name="guest_count" type="number" min={1} defaultValue={1} required className="pms-field-input" />
            <select name="reservation_status" defaultValue="pending" className="pms-field-input">
              <option value="pending">pending</option>
              <option value="confirmed">confirmed</option>
              <option value="checked_in">checked_in</option>
              <option value="checked_out">checked_out</option>
              <option value="canceled">canceled</option>
              <option value="no_show">no_show</option>
            </select>
            <select name="reservation_source" defaultValue="front_desk" className="pms-field-input">
              <option value="front_desk">front_desk</option>
              <option value="website">website</option>
              <option value="phone">phone</option>
              <option value="agency">agency</option>
            </select>
            <select name="payment_status" defaultValue="pending" className="pms-field-input">
              <option value="pending">pending</option>
              <option value="partial">partial</option>
              <option value="paid">paid</option>
              <option value="refunded">refunded</option>
            </select>
            <input name="estimated_total_amount" type="number" min={0} step="0.01" defaultValue={0} className="pms-field-input" />
            <input name="final_total_amount" type="number" min={0} step="0.01" defaultValue={0} className="pms-field-input" />
            <input name="notes" placeholder="Observacoes" className="pms-field-input" />
            <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
              Criar reserva
            </button>
          </form>
        </article>
      ) : null}

      {access.canRead ? (
        <section className="grid gap-[0.75rem]">
          {reservations.map((item) => (
            <article key={item.id} className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
              <h3 className="m-0">Reserva {item.reservation_code}</h3>
              <p className="m-0 mt-[0.2rem] text-[#555]">{item.planned_checkin_date} ate {item.planned_checkout_date} | {item.reservation_status}</p>

              {access.canUpdate ? (
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

              {access.canDelete ? (
                <form action={deleteReservationAction} className="mt-[0.45rem]">
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]">
                    Apagar
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}
