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
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem" }}>Roles</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
