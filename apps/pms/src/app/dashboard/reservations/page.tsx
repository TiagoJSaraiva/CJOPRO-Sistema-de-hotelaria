import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getReservationsCalendarAccess, getReservationsCalendarDefaultRoute } from "./access";

export default async function ReservationsCalendarPage() {
  const user = await getUserFromSession();
  const access = getReservationsCalendarAccess(user);
  const targetRoute = getReservationsCalendarDefaultRoute(access);

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Calendário de Reservas</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(targetRoute);
}
