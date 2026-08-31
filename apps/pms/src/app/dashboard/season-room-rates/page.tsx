import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import {
  getSeasonRoomRatesAccess,
  getSeasonRoomRatesDefaultRoute,
} from "./access";

type SeasonRoomRatesPageProps = {
  searchParams?: Promise<{
    status?: string;
    r?: string;
  }>;
};

export default async function SeasonRoomRatesPage({
  searchParams,
}: SeasonRoomRatesPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getSeasonRoomRatesAccess(user);
  const targetRoute = getSeasonRoomRatesDefaultRoute(access);
  const statusQuery = resolvedSearchParams?.status
    ? `?status=${encodeURIComponent(resolvedSearchParams.status)}`
    : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Tarifas por Temporada</h1>
        <p>Sem permissão para visualizar este módulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
