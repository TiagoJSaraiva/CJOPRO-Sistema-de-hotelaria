import { redirect } from "next/navigation";
import { PermissionTabs } from "../../_components/PermissionTabs";
import { listReservations } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getReservationsAccess, getReservationsDefaultRoute } from "../access";
import { ReservationsViewFilterableSection } from "../_components/ReservationsViewFilterableSection";

type ReservationsViewPageProps = {
  searchParams?: {
    status?: string;
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

    return (
      <section className="pms-surface-card">
        <h2 className="mt-0">Reservas</h2>
        <p>Sem permissao para visualizar reservas.</p>
      </section>
    );
  }

  const reservations = await listReservations();

  return (
    <section className="pms-page-stack">
      <section>
        <h1 className="pms-page-title">Reservas</h1>
        <PermissionTabs
          activeKey="view"
          items={[
            { key: "create", label: "Criar reserva", href: "/dashboard/reservations/create", isVisible: access.canCreate },
            { key: "view", label: "Ver reservas", href: "/dashboard/reservations/view", isVisible: access.canRead }
          ]}
        />
        {searchParams?.status ? <p className="pms-status-muted">Status: {searchParams.status}</p> : null}
      </section>

      <ReservationsViewFilterableSection reservations={reservations} canUpdate={access.canUpdate} canDelete={access.canDelete} />
    </section>
  );
}
