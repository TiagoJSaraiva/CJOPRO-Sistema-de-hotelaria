import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getRolesAccess, getRolesDefaultRoute } from "./access";

type RolesPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function RolesPage({ searchParams }: RolesPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getRolesAccess(user);
  const targetRoute = getRolesDefaultRoute(access);
  const statusQuery = resolvedSearchParams?.status
    ? `?status=${encodeURIComponent(resolvedSearchParams.status)}`
    : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Roles</h1>
        <p>Sem permissão para visualizar este módulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
