import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getPermissionsAccess, getPermissionsDefaultRoute } from "./access";

type PermissionsPageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function PermissionsPage({ searchParams }: PermissionsPageProps) {
  const user = await getUserFromSession();
  const access = getPermissionsAccess(user);
  const targetRoute = getPermissionsDefaultRoute(access);
  const statusQuery = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Permissoes</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
