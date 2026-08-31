import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getUsersAccess, getUsersDefaultRoute } from "./access";

type UsersPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getUsersAccess(user);
  const targetRoute = getUsersDefaultRoute(access);
  const statusQuery = resolvedSearchParams?.status
    ? `?status=${encodeURIComponent(resolvedSearchParams.status)}`
    : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Usuários</h1>
        <p>Sem permissão para visualizar este módulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
