import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import { getReservationsCalendarAccess, getReservationsCalendarDefaultRoute } from "../access";
import { CheckoutByRoomWorkflow } from "../_components/CheckoutByRoomWorkflow";

export default async function ReservationsCheckoutPage() {
  const user = await getUserFromSession();
  const access = getReservationsCalendarAccess(user);

  if (!access.canAccess) {
    const fallback = getReservationsCalendarDefaultRoute(access);
    if (fallback) {
      redirect(fallback);
    }
    return <DashboardAccessDeniedCard title="Calendario de Reservas" message="Sem permissao para executar checkout de reservas." />;
  }

  return (
    <DashboardEntityPageShell
      title="Calendario de Reservas"
      activeTabKey="checkout"
      tabs={[
        { key: "calendar", label: "Calendario", href: "/dashboard/reservations/view", isVisible: access.canAccess },
        { key: "checkout", label: "Checkout", href: "/dashboard/reservations/checkout", isVisible: access.canAccess }
      ]}
    >
      <CheckoutByRoomWorkflow />
    </DashboardEntityPageShell>
  );
}
