import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { getUserFromSession } from "../../../../lib/auth";
import { createReservationAction } from "../actions";
import { getReservationsAccess, getReservationsDefaultRoute } from "../access";

type ReservationsCreatePageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function ReservationsCreatePage({ searchParams }: ReservationsCreatePageProps) {
  const user = await getUserFromSession();
  const access = getReservationsAccess(user);

  if (!access.canCreate) {
    const fallback = getReservationsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Reservas</h2>
        <p>Sem permissao para criar reserva.</p>
      </section>
    );
  }

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Reservas</h1>
        <PermissionTabs
          activeKey="create"
          items={[
            { key: "create", label: "Criar reserva", href: "/dashboard/reservations/create", isVisible: access.canCreate },
            { key: "view", label: "Ver reservas", href: "/dashboard/reservations/view", isVisible: access.canRead }
          ]}
        />
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

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
    </section>
  );
}
