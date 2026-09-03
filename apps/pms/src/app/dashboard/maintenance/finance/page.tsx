import { DashboardAccessDeniedCard } from "../../_components/DashboardAccessDeniedCard";
import { DashboardEntityPageShell } from "../../_components/DashboardEntityPageShell";
import { getUserFromSession } from "../../../../lib/auth";
import {
  getMaintenanceFinanceItems,
  getMaintenanceFinanceSummary,
} from "../../../../lib/adminApi";
import { getMaintenanceAccess } from "../access";
import { MaintenanceFinanceBoard } from "../_components/MaintenanceFinanceBoard";
import { maintenanceFinanceGuide } from "../usageGuides";

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
      key: "agenda",
      label: "Minha agenda",
      href: "/dashboard/maintenance/agenda",
      isVisible: access.canExecute,
    },
    {
      key: "preventive",
      label: "Preventivas",
      href: "/dashboard/maintenance/preventive",
      isVisible: access.canManagePlans || access.canExecute,
    },
    {
      key: "suppliers",
      label: "Fornecedores",
      href: "/dashboard/maintenance/suppliers",
      isVisible: access.canManageSuppliers,
    },
    {
      key: "analytics",
      label: "Indicadores",
      href: "/dashboard/maintenance/analytics",
      isVisible: access.canReadAnalytics,
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
      usageGuide={maintenanceFinanceGuide}
    >
      <div
        className="mb-5 grid gap-3 sm:grid-cols-2"
        data-usage-guide="maintenance-finance-summary"
      >
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
      <div data-usage-guide="maintenance-finance-items">
        <MaintenanceFinanceBoard
          data={data}
          currentUserId={user?.id || ""}
          canApprove={access.canApproveFinance}
          canSettle={access.canSettleFinance}
        />
      </div>
    </DashboardEntityPageShell>
  );
}
