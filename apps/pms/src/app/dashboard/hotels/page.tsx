import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getHotelAccess, getHotelDefaultRoute } from "./access";

type HotelsPageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function HotelsPage({ searchParams }: HotelsPageProps) {
  const user = await getUserFromSession();
  const access = getHotelAccess(user);
  const targetRoute = getHotelDefaultRoute(access);
  const statusQuery = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";

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
