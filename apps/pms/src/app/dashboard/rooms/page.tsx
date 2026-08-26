import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getRoomsAccess, getRoomsDefaultRoute } from "./access";

type RoomsPageProps = {
  searchParams?: Promise<{
    status?: string;
    r?: string;
  }>;
};

export default async function RoomsPage({ searchParams }: RoomsPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getRoomsAccess(user);
  const targetRoute = getRoomsDefaultRoute(access);
  const statusQuery = resolvedSearchParams?.status ? `?status=${encodeURIComponent(resolvedSearchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Quartos</h1>
        <p>Sem permissão para visualizar este módulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
