import { redirect } from "next/navigation";
import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getReservationsCalendar, listCustomers } from "../../../../lib/adminApi";
import { getUserFromSession } from "../../../../lib/auth";
import { getReservationsCalendarAccess, getReservationsCalendarDefaultRoute } from "../access";
import { ReservationsCalendarBoard } from "../_components/ReservationsCalendarBoard";
import { CALENDAR_WINDOW_DAYS } from "../_components/calendarUtils";

type ReservationsCalendarViewPageProps = {
  searchParams?: {
    start_date?: string;
  };
};

function resolveStartDate(rawValue: string | undefined): string {
  const value = String(rawValue || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return new Date().toISOString().slice(0, 10);
}

export default async function ReservationsCalendarViewPage({ searchParams }: ReservationsCalendarViewPageProps) {
  const user = await getUserFromSession();
  const access = getReservationsCalendarAccess(user);

  if (!access.canAccess) {
    const fallback = getReservationsCalendarDefaultRoute(access);
    if (fallback) {
      redirect(fallback);
    }
    return <DashboardAccessDeniedCard title="Calendário de Reservas" message="Sem permissão para visualizar o calendário de reservas." />;
  }

  const startDate = resolveStartDate(searchParams?.start_date);
  const [data, customers] = await Promise.all([getReservationsCalendar(startDate, CALENDAR_WINDOW_DAYS), listCustomers()]);

  return (
    <DashboardEntityPageShell
      title="Calendário de Reservas"
      activeTabKey="view"
      tabs={[{ key: "view", label: "Visualização", href: "/dashboard/reservations/view", isVisible: access.canAccess }]}
    >
      <ReservationsCalendarBoard data={data} startDate={startDate} customers={customers} />
    </DashboardEntityPageShell>
  );
}
