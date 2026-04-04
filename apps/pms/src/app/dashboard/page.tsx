import { redirect } from "next/navigation";
import { getUserFromSession } from "../../lib/auth";
import { logoutAction } from "./actions";

export default async function DashboardPage() {
  const user = await getUserFromSession();

  if (!user) {
    redirect("/login");
  }

  return (
    <main style={{ minHeight: "100vh", padding: "1.25rem", background: "#f5f6f8" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ marginTop: "0.35rem", color: "#555" }}>Bem-vindo, {user.name}.</p>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            style={{ border: "1px solid #d0d0d0", background: "#fff", borderRadius: "8px", padding: "0.55rem 0.9rem", cursor: "pointer" }}
          >
            Sair
          </button>
        </form>
      </header>

      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <p style={{ marginTop: 0 }}>Dashboard inicial vazio. Proxima etapa: navbar e componentes por permissao.</p>
      </section>
    </main>
  );
}
