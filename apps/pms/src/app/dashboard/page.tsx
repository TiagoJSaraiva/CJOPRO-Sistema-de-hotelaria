import Link from "next/link";
import { PERMISSIONS } from "@hotel/shared";
import { getManagementAlerts } from "../../lib/adminApi";
import { getUserFromSession } from "../../lib/auth";
import { getConsumptionAccess } from "./consumption/access";

export default async function DashboardPage() {
  const user = await getUserFromSession();
  const access = getConsumptionAccess(user);
  const canReadAlerts = Boolean(
    access.canReadAnalytics ||
    access.canReadSettlements ||
    access.canPrepareSettlements ||
    access.canApproveSettlements ||
    access.canSettleSettlements ||
    user?.permissions.includes(PERMISSIONS.RESERVATIONS_CALENDAR_ACCESS) ||
    user?.permissions.includes(PERMISSIONS.INVENTORY_READ) ||
    user?.permissions.includes(PERMISSIONS.COMMERCIAL_PARTNERS_READ),
  );
  const alerts = canReadAlerts
    ? await getManagementAlerts().catch(() => null)
    : null;
  const groups = alerts
    ? ([
        ["Saldos de hóspedes", alerts.guest_balances],
        ["Estoque crítico", alerts.critical_stock],
        ["Acordos vencendo", alerts.expiring_agreements],
        ["Apurações pendentes", alerts.pending_settlements],
      ] as const)
    : [];
  return (
    <section className="pms-page-stack">
      <div>
        <h1 className="pms-page-title">Painel administrativo</h1>
        <p className="mt-1 text-slate-600">
          Prioridades operacionais e financeiras do hotel ativo.
        </p>
      </div>
      {groups.length ? (
        <section aria-labelledby="management-alerts-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="management-alerts-title" className="m-0 text-xl">
              Alertas gerenciais
            </h2>
            {access.canReadAnalytics ? (
              <Link
                className="pms-link"
                href="/dashboard/consumption/analytics"
              >
                Abrir painel gerencial
              </Link>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {groups.map(([label, items]) => (
              <article className="pms-surface-card" key={label}>
                <p className="m-0 text-sm text-slate-600">{label}</p>
                <strong className="my-2 block text-3xl">{items.length}</strong>
                {items[0] ? (
                  <Link className="pms-link" href={items[0].href}>
                    {items[0].title}
                  </Link>
                ) : (
                  <span className="text-sm text-emerald-700">
                    Nenhuma pendência
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="pms-surface-card">
          <h2 className="mt-0">Visão geral</h2>
          <p className="mb-0 text-slate-600">
            Os módulos disponíveis aparecem na navegação conforme suas
            permissões.
          </p>
        </section>
      )}
    </section>
  );
}
