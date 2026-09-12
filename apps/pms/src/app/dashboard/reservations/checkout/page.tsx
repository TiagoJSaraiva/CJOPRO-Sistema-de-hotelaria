import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import {
  getReservationsCalendarAccess,
  getReservationsCalendarDefaultRoute,
} from "../access";
import { CheckoutByRoomWorkflow } from "../_components/CheckoutByRoomWorkflow";
import { maintenanceCheckoutGuide } from "../../maintenance/usageGuides";
import { reservationOperationsTabs } from "../stage6Tabs";

export default async function ReservationsCheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<{ room_number?: string }>;
}) {
  const params = await searchParams;
  const user = await getUserFromSession();
  const access = getReservationsCalendarAccess(user);

  if (!access.canAccess) {
    const fallback = getReservationsCalendarDefaultRoute(access);
    if (fallback) {
      redirect(fallback);
    }
    return (
      <DashboardAccessDeniedCard
        title="Calendario de Reservas"
        message="Sem permissao para executar checkout de reservas."
      />
    );
  }

  return (
    <DashboardEntityPageShell
      title="Calendario de Reservas"
      activeTabKey="checkout"
      usageGuide={maintenanceCheckoutGuide}
      tabs={reservationOperationsTabs(user)}
    >
      <CheckoutByRoomWorkflow initialRoomNumber={params?.room_number || ""} />
    </DashboardEntityPageShell>
  );
}
