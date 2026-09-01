import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import {
  getMaintenanceFinanceItems,
  getMaintenanceFinanceSummary,
} from "../../../../lib/adminApi";
import { getMaintenanceAccess } from "../access";
import { MaintenanceFinanceBoard } from "../_components/MaintenanceFinanceBoard";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}

export default async function MaintenanceFinancePage({ searchParams }: Props) {
  const user = await getUserFromSession();
  const access = getMaintenanceAccess(user);
  if (!access.canReadFinance)
    return (
      <DashboardAccessDeniedCard
        title="Financeiro de manutenção"
        message="Sem permissão para consultar valores e documentos de manutenção."
      />
    );
  const raw = await searchParams;
  const queue = typeof raw?.queue === "string" ? raw.queue : "approval";
  const query = new URLSearchParams({ queue });
  const [summary, data] = await Promise.all([
    getMaintenanceFinanceSummary(),
    getMaintenanceFinanceItems(query.toString()),
  ]);
  const tabs = [
    {
      key: "view",
      label: "Operação",
      href: "/dashboard/maintenance/view",
      isVisible: access.canRead,
    },
    {
      key: "approval",
      label: `Aprovação (${summary.awaiting_approval})`,
      href: "/dashboard/maintenance/finance?queue=approval",
      isVisible: true,
    },
    {
      key: "payable",
      label: `A pagar (${summary.payable})`,
      href: "/dashboard/maintenance/finance?queue=payable",
      isVisible: true,
    },
    {
      key: "receivable",
      label: `A receber (${summary.receivable})`,
      href: "/dashboard/maintenance/finance?queue=receivable",
      isVisible: true,
    },
    {
      key: "overdue",
      label: `Vencidos (${summary.overdue})`,
      href: "/dashboard/maintenance/finance?queue=overdue",
      isVisible: true,
    },
    {
      key: "settled",
      label: `Liquidados (${summary.settled})`,
      href: "/dashboard/maintenance/finance?queue=settled",
      isVisible: true,
    },
    {
      key: "report",
      label: "Registrar",
      href: "/dashboard/maintenance/report",
      isVisible: access.canCreate,
    },
    {
      key: "settings",
      label: "Configuração",
      href: "/dashboard/maintenance/settings",
      isVisible: access.canManageCatalogs,
    },
  ];
  return (
    <DashboardEntityPageShell
      title="Financeiro de manutenção"
      activeTabKey={queue}
      tabs={tabs}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Contas a pagar
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {money(summary.payable_amount, summary.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Contas a receber
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {money(summary.receivable_amount, summary.currency)}
          </p>
        </div>
      </div>
      <MaintenanceFinanceBoard
        data={data}
        currentUserId={user?.id || ""}
        canApprove={access.canApproveFinance}
        canSettle={access.canSettleFinance}
      />
    </DashboardEntityPageShell>
  );
}
