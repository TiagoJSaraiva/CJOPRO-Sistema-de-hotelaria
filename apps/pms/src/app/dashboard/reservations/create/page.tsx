import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import { createReservationAction } from "../actions";
import { getReservationsAccess, getReservationsDefaultRoute } from "../access";
import { ReservationStatusMessage } from "../_components/ReservationStatusMessage";

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

    return <DashboardAccessDeniedCard title="Reservas" message="Sem permissao para criar reserva." />;
  }

  return (
    <DashboardEntityPageShell
      title="Reservas"
      activeTabKey="create"
      tabs={[
        { key: "create", label: "Criar reserva", href: "/dashboard/reservations/create", isVisible: access.canCreate },
        { key: "view", label: "Ver reservas", href: "/dashboard/reservations/view", isVisible: access.canRead }
      ]}
      statusContent={<ReservationStatusMessage status={searchParams?.status} />}
    >
      <DashboardCreateFormCard title="Criar reserva" submitLabel="Criar reserva" action={createReservationAction} resetKey={searchParams?.r}>
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
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
