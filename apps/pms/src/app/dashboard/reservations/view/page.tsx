import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { listReservations } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getReservationsAccess, getReservationsDefaultRoute } from "../access";
import { ReservationsViewFilterableSection } from "../_components/ReservationsViewFilterableSection";

type ReservationsViewPageProps = {
  searchParams?: {
    status?: string;
    reservationId?: string;
    mode?: string;
  };
};

export default async function ReservationsViewPage({ searchParams }: ReservationsViewPageProps) {
  const user = await getUserFromSession();
  const access = getReservationsAccess(user);

  if (!access.canRead) {
    const fallback = getReservationsDefaultRoute(access);

    if (fallback) {
      redirect(fallback);
    }

    return <DashboardAccessDeniedCard title="Reservas" message="Sem permissao para visualizar reservas." />;
  }

  const reservations = await listReservations();
  const activeReservationId = String(searchParams?.reservationId || "").trim();
  const mode = searchParams?.mode === "edit" ? "edit" : "view";

  return (
    <DashboardEntityPageShell
      title="Reservas"
      activeTabKey="view"
      tabs={[
        { key: "create", label: "Criar reserva", href: "/dashboard/reservations/create", isVisible: access.canCreate },
        { key: "view", label: "Ver reservas", href: "/dashboard/reservations/view", isVisible: access.canRead }
      ]}
      status={searchParams?.status}
    >
      <ReservationsViewFilterableSection
        reservations={reservations}
        canRead={access.canRead}
        canUpdate={access.canUpdate}
        canDelete={access.canDelete}
        activeReservationId={activeReservationId}
        mode={mode}
      />
    </DashboardEntityPageShell>
  );
}
