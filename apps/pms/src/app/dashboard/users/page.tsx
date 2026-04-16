import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getUsersAccess, getUsersDefaultRoute } from "./access";

type UsersPageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const user = await getUserFromSession();
  const access = getUsersAccess(user);
  const targetRoute = getUsersDefaultRoute(access);
  const statusQuery = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Usuarios</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
