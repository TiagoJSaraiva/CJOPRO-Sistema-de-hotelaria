import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardCreateFormCard } from "../../_components/DashboardCreateFormCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { FormField } from "../../_components/FormField";
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
        <FormField label="Booking customer ID" htmlFor="create-reservation-booking-customer-id">
          <input id="create-reservation-booking-customer-id" name="booking_customer_id" required className="pms-field-input" />
        </FormField>

        <FormField label="Codigo da reserva" htmlFor="create-reservation-code">
          <input id="create-reservation-code" name="reservation_code" required className="pms-field-input" />
        </FormField>

        <FormField label="Check-in planejado" htmlFor="create-reservation-checkin-date">
          <input id="create-reservation-checkin-date" name="planned_checkin_date" type="date" required className="pms-field-input" />
        </FormField>

        <FormField label="Checkout planejado" htmlFor="create-reservation-checkout-date">
          <input id="create-reservation-checkout-date" name="planned_checkout_date" type="date" required className="pms-field-input" />
        </FormField>

        <FormField label="Quantidade de hospedes" htmlFor="create-reservation-guest-count">
          <input id="create-reservation-guest-count" name="guest_count" type="number" min={1} defaultValue={1} required className="pms-field-input" />
        </FormField>

        <FormField label="Status da reserva" htmlFor="create-reservation-status">
          <select id="create-reservation-status" name="reservation_status" defaultValue="pending" className="pms-field-input">
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="checked_in">checked_in</option>
            <option value="checked_out">checked_out</option>
            <option value="canceled">canceled</option>
            <option value="no_show">no_show</option>
          </select>
        </FormField>

        <FormField label="Origem da reserva" htmlFor="create-reservation-source">
          <select id="create-reservation-source" name="reservation_source" defaultValue="front_desk" className="pms-field-input">
            <option value="front_desk">front_desk</option>
            <option value="website">website</option>
            <option value="phone">phone</option>
            <option value="agency">agency</option>
          </select>
        </FormField>

        <FormField label="Status do pagamento" htmlFor="create-reservation-payment-status">
          <select id="create-reservation-payment-status" name="payment_status" defaultValue="pending" className="pms-field-input">
            <option value="pending">pending</option>
            <option value="partial">partial</option>
            <option value="paid">paid</option>
            <option value="refunded">refunded</option>
          </select>
        </FormField>

        <FormField label="Valor total estimado" htmlFor="create-reservation-estimated-total-amount">
          <input id="create-reservation-estimated-total-amount" name="estimated_total_amount" type="number" min={0} step="0.01" defaultValue={0} className="pms-field-input" />
        </FormField>

        <FormField label="Valor total final" htmlFor="create-reservation-final-total-amount">
          <input id="create-reservation-final-total-amount" name="final_total_amount" type="number" min={0} step="0.01" defaultValue={0} className="pms-field-input" />
        </FormField>

        <FormField label="Observacoes" htmlFor="create-reservation-notes" fullWidth>
          <input id="create-reservation-notes" name="notes" className="pms-field-input" />
        </FormField>
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
