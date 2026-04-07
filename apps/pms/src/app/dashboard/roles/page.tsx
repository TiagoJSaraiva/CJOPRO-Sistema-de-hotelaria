import { PERMISSIONS } from "@hotel/shared";
import { getUserFromSession } from "../../../lib/auth";
import { type AdminRole, listRoles } from "../../../lib/adminApi";
import { AdminTable } from "../_components/AdminTable";

function toRows(items: AdminRole[]): string[][] {
  return items.map((item) => [item.name, item.hotel_id || "GLOBAL"]);
}

export default async function RolesPage() {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.ROLE_READ)) {
    return (
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Roles</h2>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  const roles = await listRoles();

  return <AdminTable title="Roles" description="Etapa 1: listagem inicial para base do CRUD." columns={["Nome", "Hotel"]} rows={toRows(roles)} />;
}
