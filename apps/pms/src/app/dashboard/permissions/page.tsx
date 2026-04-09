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
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem" }}>Permissoes</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
