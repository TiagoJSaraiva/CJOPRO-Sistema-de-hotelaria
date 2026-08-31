import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getHotelAccess, getHotelDefaultRoute } from "./access";

type HotelsPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function HotelsPage({ searchParams }: HotelsPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getHotelAccess(user);
  const targetRoute = getHotelDefaultRoute(access);
  const statusQuery = resolvedSearchParams?.status
    ? `?status=${encodeURIComponent(resolvedSearchParams.status)}`
    : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Hotéis</h1>
        <p>Sem permissão para visualizar este módulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
