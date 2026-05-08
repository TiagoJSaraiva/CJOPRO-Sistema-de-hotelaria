import { redirect } from "next/navigation";
import { translateReservationSource } from "@hotel/shared";
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
    detail?: string;
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
      statusContent={<ReservationStatusMessage status={searchParams?.status} detail={searchParams?.detail} />}
    >
      <DashboardCreateFormCard title="Criar reserva" submitLabel="Criar reserva" action={createReservationAction} resetKey={searchParams?.r}>
        <FormField label="Documento do titular da reserva - Tipo" htmlFor="create-reservation-booking-customer-document-type">
          <input id="create-reservation-booking-customer-document-type" name="booking_customer_document_type" required className="pms-field-input" />
        </FormField>

        <FormField label="Documento do titular da reserva - Numero" htmlFor="create-reservation-booking-customer-document">
          <input id="create-reservation-booking-customer-document" name="booking_customer_document" required className="pms-field-input" />
        </FormField>

        <FormField label="Quantidade de hospedes" htmlFor="create-reservation-guest-count">
          <input id="create-reservation-guest-count" name="guest_count" type="number" min={1} defaultValue={1} required className="pms-field-input" />
        </FormField>

        <FormField label="Origem da reserva" htmlFor="create-reservation-source">
          <select id="create-reservation-source" name="reservation_source" defaultValue="front_desk" className="pms-field-input">
            <option value="front_desk">{translateReservationSource("front_desk")}</option>
            <option value="website">{translateReservationSource("website")}</option>
            <option value="phone">{translateReservationSource("phone")}</option>
            <option value="agency">{translateReservationSource("agency")}</option>
          </select>
        </FormField>

        <FormField label="Valor total estimado" htmlFor="create-reservation-estimated-total-price">
          <input id="create-reservation-estimated-total-price" name="estimated_total_price" type="number" min={0} step="0.01" defaultValue={0} className="pms-field-input" />
        </FormField>

        <FormField label="Valor total final" htmlFor="create-reservation-final-total-price">
          <input id="create-reservation-final-total-price" name="final_total_price" type="number" min={0} step="0.01" defaultValue={0} className="pms-field-input" />
        </FormField>

        <FormField label="Observacoes" htmlFor="create-reservation-notes" fullWidth>
          <input id="create-reservation-notes" name="notes" className="pms-field-input" />
        </FormField>
      </DashboardCreateFormCard>
    </DashboardEntityPageShell>
  );
}
