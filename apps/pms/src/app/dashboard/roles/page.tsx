import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getRolesAccess, getRolesDefaultRoute } from "./access";

type RolesPageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function RolesPage({ searchParams }: RolesPageProps) {
  const user = await getUserFromSession();
  const access = getRolesAccess(user);
  const targetRoute = getRolesDefaultRoute(access);
  const statusQuery = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Roles</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
