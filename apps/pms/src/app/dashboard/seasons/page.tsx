import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getSeasonsAccess, getSeasonsDefaultRoute } from "./access";

type SeasonsPageProps = {
  searchParams?: {
    status?: string;
    r?: string;
  };
};

export default async function SeasonsPage({ searchParams }: SeasonsPageProps) {
  const user = await getUserFromSession();
  const access = getSeasonsAccess(user);
  const targetRoute = getSeasonsDefaultRoute(access);
  const statusQuery = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Temporadas</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
