import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getPermissionsAccess, getPermissionsDefaultRoute } from "./access";

type PermissionsPageProps = {
  searchParams?: Promise<{
    status?: string;
  }>;
};

export default async function PermissionsPage({ searchParams }: PermissionsPageProps) {
  const resolvedSearchParams = await searchParams;
  const user = await getUserFromSession();
  const access = getPermissionsAccess(user);
  const targetRoute = getPermissionsDefaultRoute(access);
  const statusQuery = resolvedSearchParams?.status ? `?status=${encodeURIComponent(resolvedSearchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section className="pms-surface-card">
        <h1 className="pms-page-title">Permissões</h1>
        <p>Sem permissão para visualizar este módulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
