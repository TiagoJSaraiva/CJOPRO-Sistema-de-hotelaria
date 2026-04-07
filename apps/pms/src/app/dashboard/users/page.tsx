import { PERMISSIONS } from "@hotel/shared";
import { getUserFromSession } from "../../../lib/auth";
import { type AdminUser, listUsers } from "../../../lib/adminApi";
import { AdminTable } from "../_components/AdminTable";

function toRows(items: AdminUser[]): string[][] {
  return items.map((item) => [item.name, item.email, item.is_active ? "Ativo" : "Inativo"]);
}

export default async function UsersPage() {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.USER_READ)) {
    return (
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Usuarios</h2>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  const users = await listUsers();

  return <AdminTable title="Usuarios" description="Etapa 1: listagem inicial para base do CRUD." columns={["Nome", "Email", "Status"]} rows={toRows(users)} />;
}
