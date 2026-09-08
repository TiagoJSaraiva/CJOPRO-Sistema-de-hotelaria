import Link from "next/link";
import { OPERATIONAL_PENDING_PERMISSIONS } from "@hotel/shared";
import { getOperationalPending } from "../../lib/adminApi";
import { getUserFromSession } from "../../lib/auth";
import { PendingCards } from "./pending/PendingWorkspace";
export default async function DashboardPage() {
  const user = await getUserFromSession();
  const allowed =
    !!user &&
    OPERATIONAL_PENDING_PERMISSIONS.some((permission) =>
      user.permissions.includes(permission),
    );
  const pending = allowed
    ? await getOperationalPending().catch(() => null)
    : null;
  return (
    <section className="pms-page-stack">
      <h1 className="pms-page-title">Painel administrativo</h1>
      <p>Prioridades operacionais e financeiras do hotel ativo.</p>
      {pending ? (
        <>
          <PendingCards data={pending} />
          <Link className="pms-link" href="/dashboard/pending">
            Abrir central de pendências
          </Link>
        </>
      ) : (
        <p>
          {allowed
            ? "Não foi possível consultar as pendências. Tente novamente na central."
            : "Os módulos disponíveis aparecem na navegação conforme suas permissões."}
        </p>
      )}
    </section>
  );
}
