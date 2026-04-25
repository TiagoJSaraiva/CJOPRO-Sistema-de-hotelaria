import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getRoomsAccess, getRoomsDefaultRoute } from "./access";

type RoomsPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function RoomsPage({ searchParams }: RoomsPageProps) {
  const user = await getUserFromSession();
  const access = getRoomsAccess(user);
  const targetRoute = getRoomsDefaultRoute(access);
  const statusQuery = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Quartos</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
