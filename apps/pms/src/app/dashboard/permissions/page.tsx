import { PERMISSIONS } from "@hotel/shared";
import { getUserFromSession } from "../../../lib/auth";
import { type AdminPermission, listPermissions } from "../../../lib/adminApi";
import { AdminTable } from "../_components/AdminTable";

function toRows(items: AdminPermission[]): string[][] {
  return items.map((item) => [item.name]);
}

export default async function PermissionsPage() {
  const user = await getUserFromSession();

  if (!user || !user.permissions.includes(PERMISSIONS.PERMISSION_READ)) {
    return (
      <section style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Permissoes</h2>
        <p>Sem permissao para visualizar este modulo.</p>
      </section>
    );
  }

  const permissions = await listPermissions();

  return <AdminTable title="Permissoes" description="Etapa 1: listagem inicial para base do CRUD." columns={["Nome"]} rows={toRows(permissions)} />;
}
