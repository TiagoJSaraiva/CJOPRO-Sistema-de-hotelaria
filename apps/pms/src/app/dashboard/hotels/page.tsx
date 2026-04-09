import { redirect } from "next/navigation";
import { getUserFromSession } from "../../../lib/auth";
import { getHotelAccess, getHotelDefaultRoute } from "./access";

type HotelsPageProps = {
  searchParams?: {
    status?: string;
  };
};

export default async function HotelsPage({ searchParams }: HotelsPageProps) {
  const user = await getUserFromSession();
  const access = getHotelAccess(user);
  const targetRoute = getHotelDefaultRoute(access);
  const statusQuery = searchParams?.status ? `?status=${encodeURIComponent(searchParams.status)}` : "";

  if (!targetRoute) {
    return (
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h1 style={{ marginTop: 0, marginBottom: "0.35rem", fontSize: "3rem", marginLeft: "1rem" }}>Hoteis</h1>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  redirect(`${targetRoute}${statusQuery}`);
}
