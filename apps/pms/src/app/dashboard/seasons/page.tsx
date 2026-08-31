import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getSeasonsAccess, getSeasonsDefaultRoute } from "./access";

type SeasonsPageProps = {
  searchParams?: Promise<{
    status?: string;
    r?: string;
  }>;
};

export default async function SeasonsPage({ searchParams }: SeasonsPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getSeasonsAccess(user);
  const targetRoute = getSeasonsDefaultRoute(access);
  const statusQuery = resolvedSearchParams?.status
    ? `?status=${encodeURIComponent(resolvedSearchParams.status)}`
    : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Temporadas</h1>
        <p>Sem permissão para visualizar este módulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
