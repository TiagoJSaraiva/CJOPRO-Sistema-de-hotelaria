import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getSeasonRoomRatesAccess, getSeasonRoomRatesDefaultRoute } from "./access";

type SeasonRoomRatesPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function SeasonRoomRatesPage({ searchParams }: SeasonRoomRatesPageProps) {
  const user = await getUserFromSession();
  const access = getSeasonRoomRatesAccess(user);
  const targetRoute = getSeasonRoomRatesDefaultRoute(access);
  const statusQuery = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Tarifas por Temporada</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
