import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getReservationsAccess, getReservationsDefaultRoute } from "./access";

type ReservationsPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function ReservationsPage({ searchParams }: ReservationsPageProps) {
  const user = await getUserFromSession();
  const access = getReservationsAccess(user);
  const targetRoute = getReservationsDefaultRoute(access);
  const statusQuery = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Reservas</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
